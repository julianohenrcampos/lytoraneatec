import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  validarPermissao,
  calcularDataOperacional,
  verificarDivergenciaRelogio,
  resolverCentroCusto,
  carregarConfigCC,
  validarSequenciaBatidas,
  verificarDuplicataTemporal,
  calcularGeofence,
  verificarVelocidadeImpossivel,
  verificarHorarioSuspeito,
  uploadFotoPonto,
  limparFotoOrfa,
  registrarAuditoria,
  verificarDeduplicacao,
  extrairIp,
  type AlertaPonto,
} from "../_shared/ponto-helpers.ts";
import { validarPayloadRegistrarPonto } from "../_shared/ponto-validators.ts";

Deno.serve(async (req) => {
  // PASSO 1 — CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // PASSO 2 — Método
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ip = extrairIp(req);

  try {
    // PASSO 3 — JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // PASSO 4 — Identificar funcionário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("funcionario_id")
      .eq("id", user.id)
      .single();

    if (!profile?.funcionario_id) {
      return new Response(JSON.stringify({ error: "Usuário sem vínculo de funcionário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const funcionarioId = profile.funcionario_id;

    // PASSO 4.5 — Permissão explícita
    const temPermissao = await validarPermissao(supabaseAdmin, user.id, "ponto_registrar");
    if (!temPermissao) {
      return new Response(JSON.stringify({ error: "Sem permissão para registrar ponto" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 5 — Status do funcionário
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("status")
      .eq("id", funcionarioId)
      .single();

    if (!func || !["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return new Response(JSON.stringify({ error: "Funcionário inativo" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 6 — Validar payload
    const body = await req.json();
    const validacao = validarPayloadRegistrarPonto(body);
    if (!validacao.valido || !validacao.dados) {
      return new Response(JSON.stringify({ error: validacao.erro }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = validacao.dados;

    // PASSO 7 — Deduplicação offline
    const batidaExistente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
    if (batidaExistente) {
      return new Response(
        JSON.stringify({ duplicado: true, batida_id: batidaExistente }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 8 — Resolver centro de custo
    const ccId = await resolverCentroCusto(supabaseAdmin, funcionarioId, payload.centro_custo_id);
    if (!ccId) {
      return new Response(JSON.stringify({ error: "Centro de custo não identificado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 9 — Config do CC
    const config = await carregarConfigCC(supabaseAdmin, ccId);

    // PASSO 10 — Divergência de relógio
    const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(payload.data_hora_dispositivo);

    // PASSO 10.5 — Data operacional
    const dataOperacional = calcularDataOperacional(dataHoraConsiderada);

    // PASSO 11 — Sequência
    const seq = await validarSequenciaBatidas(supabaseAdmin, funcionarioId, dataOperacional, payload.tipo_batida);
    if (!seq.valido) {
      return new Response(
        JSON.stringify({ error: seq.erro, batidas_dia: seq.batidasDia }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 12 — Duplicata temporal
    const isDuplicata = await verificarDuplicataTemporal(
      supabaseAdmin, funcionarioId, payload.tipo_batida, dataHoraConsiderada
    );
    if (isDuplicata) {
      return new Response(
        JSON.stringify({ error: "Batida duplicada. Aguarde 5 minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Coletar alertas e status
    const alertas: AlertaPonto[] = [];
    let statusValidacao = "valida";
    const justificativas: string[] = [];

    if (flagDivergencia) {
      alertas.push({ tipo: "divergencia_relogio", mensagem: "Relógio do dispositivo diverge > 5min" });
    }

    // PASSO 13 — GPS
    if (config.exige_gps) {
      if (payload.latitude == null || payload.longitude == null) {
        statusValidacao = "pendente_revisao";
        justificativas.push("GPS não disponível");
        alertas.push({ tipo: "sem_gps", mensagem: "GPS não disponível" });
      } else if (payload.precisao_gps_metros && payload.precisao_gps_metros > 100) {
        statusValidacao = "pendente_revisao";
        justificativas.push("Precisão GPS > 100m");
        alertas.push({ tipo: "gps_impreciso", mensagem: `Precisão: ${payload.precisao_gps_metros}m` });
      }
    }

    // PASSO 14 — Geofence
    let dentroRaio: boolean | null = null;
    let distanciaMetros: number | null = null;
    const geofence = await calcularGeofence(supabaseAdmin, payload.latitude, payload.longitude, ccId);
    if (geofence) {
      dentroRaio = geofence.dentroRaio;
      distanciaMetros = geofence.distanciaMetros;
      if (!geofence.dentroRaio) {
        if (!config.permite_ponto_fora_raio) {
          return new Response(
            JSON.stringify({
              error: "Fora do raio permitido",
              distancia: geofence.distanciaMetros,
              raio: config.raio_metros,
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        statusValidacao = "pendente_revisao";
        justificativas.push(`Fora do raio: ${geofence.distanciaMetros}m`);
        alertas.push({ tipo: "fora_raio", mensagem: `Distância: ${geofence.distanciaMetros}m` });
      }
    }

    // PASSO 15 — Velocidade impossível
    const velocidadeImpossivel = await verificarVelocidadeImpossivel(
      supabaseAdmin, funcionarioId, payload.latitude, payload.longitude, dataHoraConsiderada
    );
    if (velocidadeImpossivel) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Velocidade de deslocamento impossível");
      alertas.push({ tipo: "velocidade_impossivel", mensagem: "Deslocamento suspeito" });
    }

    // PASSO 16 — Horário suspeito
    if (verificarHorarioSuspeito(dataHoraConsiderada)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Horário suspeito (00-04h)");
      alertas.push({ tipo: "horario_suspeito", mensagem: "Registro entre 00:00 e 04:00" });
    }

    // PASSO 17 — Foto
    let fotoUrl: string | null = null;
    if (payload.foto_base64) {
      fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, payload.foto_base64);
      if (!fotoUrl) {
        alertas.push({ tipo: "foto_falha", mensagem: "Upload de foto falhou" });
        if (config.exige_foto) {
          statusValidacao = "pendente_revisao";
          justificativas.push("Upload de foto falhou");
        }
      }
    } else if (config.exige_foto) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Foto não fornecida");
      alertas.push({ tipo: "sem_foto", mensagem: "Foto obrigatória não fornecida" });
    }

    // PASSO 18 — INSERT
    const batidaRow = {
      funcionario_id: funcionarioId,
      centro_custo_id: ccId,
      dispositivo_id: null,
      tipo_batida: payload.tipo_batida,
      modo_registro: "pwa_pessoal",
      data_hora_dispositivo: payload.data_hora_dispositivo,
      data_hora_servidor: new Date().toISOString(),
      data_hora_considerada: dataHoraConsiderada,
      data_operacional: dataOperacional,
      latitude: payload.latitude,
      longitude: payload.longitude,
      precisao_gps_metros: payload.precisao_gps_metros,
      dentro_raio: dentroRaio,
      distancia_centro_metros: distanciaMetros,
      foto_url: fotoUrl,
      origem_dados: payload.offline_uuid ? "offline_sync" : "online",
      offline_uuid: payload.offline_uuid,
      status_validacao: statusValidacao,
      status_sync: "sincronizado",
      justificativa: justificativas.length > 0 ? justificativas.join("; ") : null,
      ip_address: ip,
      user_agent: payload.user_agent || req.headers.get("user-agent"),
      device_fingerprint: payload.device_fingerprint,
    };

    const { data: batida, error: insertError } = await supabaseAdmin
      .from("bd_ponto_batidas")
      .insert(batidaRow)
      .select("id")
      .single();

    if (insertError) {
      // Constraint de offline_uuid duplicado = idempotência
      if (insertError.code === "23505" && payload.offline_uuid) {
        const existente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
        return new Response(
          JSON.stringify({ duplicado: true, batida_id: existente }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // PASSO 18.5 — Limpar foto órfã
      if (fotoUrl) {
        await limparFotoOrfa(supabaseAdmin, fotoUrl);
      }

      console.error("[registrar-ponto] INSERT falhou:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao registrar batida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 19 — Auditoria
    await registrarAuditoria(
      supabaseAdmin, "bd_ponto_batidas", batida.id, "INSERT",
      batidaRow, user.id, ip
    );

    console.log(
      `[registrar-ponto] OK func=${funcionarioId} tipo=${payload.tipo_batida} cc=${ccId} dist=${distanciaMetros ?? "N/A"}m status=${statusValidacao}`
    );

    // PASSO 20 — Resposta
    return new Response(
      JSON.stringify({
        batida_id: batida.id,
        tipo_batida: payload.tipo_batida,
        data_hora_considerada: dataHoraConsiderada,
        data_operacional: dataOperacional,
        dentro_raio: dentroRaio,
        distancia_centro_metros: distanciaMetros,
        status_validacao: statusValidacao,
        alertas,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[registrar-ponto] Erro geral:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
