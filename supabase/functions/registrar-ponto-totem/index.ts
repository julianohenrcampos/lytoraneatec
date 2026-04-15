import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  calcularDataOperacional,
  verificarDivergenciaRelogio,
  carregarConfigCC,
  validarSequenciaBatidas,
  verificarDuplicataTemporal,
  verificarVelocidadeImpossivel,
  verificarHorarioSuspeito,
  uploadFotoPonto,
  limparFotoOrfa,
  registrarAuditoria,
  verificarDeduplicacao,
  validarDispositivoTotem,
  extrairIp,
  type AlertaPonto,
} from "../_shared/ponto-helpers.ts";
import { validarPayloadTotem } from "../_shared/ponto-validators.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ip = extrairIp(req);

  try {
    // PASSO 3 — API Key global
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("LYTOTEC_API_KEY");
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(JSON.stringify({ error: "API key inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 4 — Validar payload
    const body = await req.json();
    const validacao = validarPayloadTotem(body);
    if (!validacao.valido || !validacao.dados) {
      return new Response(JSON.stringify({ error: validacao.erro }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = validacao.dados;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // PASSO 5 — Validar dispositivo (API key + device secret)
    const deviceSecret = req.headers.get("x-device-secret");
    const dispResult = await validarDispositivoTotem(supabaseAdmin, payload.codigo_dispositivo, deviceSecret);
    if (!dispResult.valido) {
      return new Response(JSON.stringify({ error: dispResult.erro }), {
        status: dispResult.status!, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dispositivo = dispResult.dispositivo!;

    // PASSO 6 — Identificar funcionário
    const campo = payload.tipo_identificador === "cpf" ? "cpf" : "matricula";
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("id, status, centro_custo_id")
      .eq(campo, payload.identificador_funcionario)
      .single();

    if (!func) {
      return new Response(JSON.stringify({ error: "Funcionário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return new Response(JSON.stringify({ error: "Funcionário inativo" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const funcionarioId = func.id;
    const ccIdTotem = dispositivo.centro_custo_id;

    // PASSO 7 — Deduplicação offline
    const batidaExistente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
    if (batidaExistente) {
      return new Response(
        JSON.stringify({ duplicado: true, batida_id: batidaExistente }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 8 — Verificar vínculo com CC do totem
    const { data: vinculo } = await supabaseAdmin
      .from("bd_ponto_vinculos_operacionais")
      .select("id")
      .eq("funcionario_id", funcionarioId)
      .eq("centro_custo_id", ccIdTotem)
      .eq("ativo", true)
      .limit(1);

    const temVinculoDireto = vinculo && vinculo.length > 0;
    const temVinculoFallback = func.centro_custo_id === ccIdTotem;

    if (!temVinculoDireto && !temVinculoFallback) {
      return new Response(JSON.stringify({ error: "Funcionário sem vínculo com esta obra" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 9 — Config do CC
    const config = await carregarConfigCC(supabaseAdmin, ccIdTotem);

    // PASSO 10 — Divergência de relógio
    const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(payload.data_hora_dispositivo);
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
    const isDup = await verificarDuplicataTemporal(supabaseAdmin, funcionarioId, payload.tipo_batida, dataHoraConsiderada);
    if (isDup) {
      return new Response(JSON.stringify({ error: "Batida duplicada. Aguarde 5 minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const alertas: AlertaPonto[] = [];
    let statusValidacao = "valida";
    const justificativas: string[] = [];

    if (flagDivergencia) {
      alertas.push({ tipo: "divergencia_relogio", mensagem: "Relógio diverge > 5min" });
    }

    // PASSO 13 — Horário suspeito
    if (verificarHorarioSuspeito(dataHoraConsiderada)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Horário suspeito (00-04h)");
      alertas.push({ tipo: "horario_suspeito", mensagem: "Registro entre 00:00 e 04:00" });
    }

    // Velocidade impossível (última batida geral vs coordenada fixa do totem)
    if (dispositivo.latitude_fixa != null && dispositivo.longitude_fixa != null) {
      const velImpossivel = await verificarVelocidadeImpossivel(
        supabaseAdmin, funcionarioId, dispositivo.latitude_fixa, dispositivo.longitude_fixa, dataHoraConsiderada
      );
      if (velImpossivel) {
        statusValidacao = "pendente_revisao";
        justificativas.push("Velocidade de deslocamento impossível");
        alertas.push({ tipo: "velocidade_impossivel", mensagem: "Deslocamento suspeito" });
      }
    }

    // PASSO 14 — Foto
    let fotoUrl: string | null = null;
    if (payload.foto_base64) {
      fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, payload.foto_base64);
      if (!fotoUrl && config.exige_foto) {
        statusValidacao = "pendente_revisao";
        justificativas.push("Upload de foto falhou");
      }
    } else if (config.exige_foto) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Foto não fornecida");
    }

    // PASSO 15 — INSERT
    const batidaRow = {
      funcionario_id: funcionarioId,
      centro_custo_id: ccIdTotem,
      dispositivo_id: dispositivo.id,
      tipo_batida: payload.tipo_batida,
      modo_registro: "totem",
      data_hora_dispositivo: payload.data_hora_dispositivo,
      data_hora_servidor: new Date().toISOString(),
      data_hora_considerada: dataHoraConsiderada,
      data_operacional: dataOperacional,
      latitude: dispositivo.latitude_fixa,
      longitude: dispositivo.longitude_fixa,
      precisao_gps_metros: null,
      dentro_raio: true,
      distancia_centro_metros: 0,
      foto_url: fotoUrl,
      origem_dados: "online",
      offline_uuid: payload.offline_uuid,
      status_validacao: statusValidacao,
      status_sync: "sincronizado",
      justificativa: justificativas.length > 0 ? justificativas.join("; ") : null,
      ip_address: ip,
      user_agent: null,
      device_fingerprint: null,
    };

    const { data: batida, error: insertError } = await supabaseAdmin
      .from("bd_ponto_batidas")
      .insert(batidaRow)
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505" && payload.offline_uuid) {
        const existente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
        return new Response(
          JSON.stringify({ duplicado: true, batida_id: existente }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (fotoUrl) await limparFotoOrfa(supabaseAdmin, fotoUrl);
      console.error("[registrar-ponto-totem] INSERT falhou:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao registrar batida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PASSO 16 — Auditoria
    await registrarAuditoria(supabaseAdmin, "bd_ponto_batidas", batida.id, "INSERT", batidaRow, null, ip);

    console.log(
      `[registrar-ponto-totem] OK func=${funcionarioId} tipo=${payload.tipo_batida} disp=${payload.codigo_dispositivo}`
    );

    // PASSO 17 — Resposta
    return new Response(
      JSON.stringify({
        batida_id: batida.id,
        tipo_batida: payload.tipo_batida,
        data_hora_considerada: dataHoraConsiderada,
        data_operacional: dataOperacional,
        dentro_raio: true,
        distancia_centro_metros: 0,
        status_validacao: statusValidacao,
        alertas,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[registrar-ponto-totem] Erro geral:", e);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
