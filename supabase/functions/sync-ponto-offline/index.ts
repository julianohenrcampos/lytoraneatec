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
} from "../_shared/ponto-helpers.ts";
import { validarPayloadSyncOffline, type PayloadBatidaOffline } from "../_shared/ponto-validators.ts";

interface ResultadoBatida {
  offline_uuid: string;
  status: "sincronizado" | "duplicado" | "erro";
  batida_id?: string;
  erro?: string;
  codigo?: string;
}

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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ip = extrairIp(req);

  try {
    // Auth JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Identificar funcionário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("funcionario_id")
      .eq("id", user.id)
      .single();

    if (!profile?.funcionario_id) {
      return new Response(JSON.stringify({ error: "Usuário sem vínculo de funcionário" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const funcionarioId = profile.funcionario_id;

    // Permissão
    const temPermissao = await validarPermissao(supabaseAdmin, user.id, "ponto_registrar");
    if (!temPermissao) {
      return new Response(JSON.stringify({ error: "Sem permissão para registrar ponto" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Status funcionário
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("status")
      .eq("id", funcionarioId)
      .single();

    if (!func || !["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return new Response(JSON.stringify({ error: "Funcionário inativo" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar payload
    const body = await req.json();
    const validacao = validarPayloadSyncOffline(body);
    if (!validacao.valido || !validacao.dados) {
      return new Response(JSON.stringify({ error: validacao.erro }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ordenar cronologicamente
    const batidasOrdenadas = [...validacao.dados.batidas].sort(
      (a, b) => new Date(a.data_hora_dispositivo).getTime() - new Date(b.data_hora_dispositivo).getTime()
    );

    const resultados: ResultadoBatida[] = [];
    const batidasInseridas: string[] = []; // tipo_batida das já inseridas neste lote
    let sincronizados = 0;
    let duplicados = 0;

    for (const batida of batidasOrdenadas) {
      try {
        const resultado = await processarBatidaOffline(
          supabaseAdmin, funcionarioId, batida, batidasInseridas, ip, user.id, req
        );
        resultados.push(resultado);

        if (resultado.status === "sincronizado") {
          sincronizados++;
          batidasInseridas.push(batida.tipo_batida);
        } else if (resultado.status === "duplicado") {
          duplicados++;
        }
      } catch (e) {
        console.error(`[sync-offline] Erro batida ${batida.offline_uuid}:`, e);
        resultados.push({
          offline_uuid: batida.offline_uuid,
          status: "erro",
          erro: "Erro interno ao processar batida",
          codigo: "ERRO_INTERNO",
        });
      }
    }

    console.log(
      `[sync-offline] LOTE func=${funcionarioId} total=${batidasOrdenadas.length} ok=${sincronizados} dup=${duplicados} err=${resultados.filter(r => r.status === "erro").length}`
    );

    return new Response(
      JSON.stringify({
        total: batidasOrdenadas.length,
        sincronizados,
        duplicados,
        erros: resultados.filter((r) => r.status === "erro"),
        resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[sync-offline] Erro geral:", e);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processarBatidaOffline(
  supabaseAdmin: any,
  funcionarioId: string,
  batida: PayloadBatidaOffline,
  batidasJaInseridas: string[],
  ip: string | null,
  userId: string,
  req: Request
): Promise<ResultadoBatida> {
  // Deduplicação
  const existente = await verificarDeduplicacao(supabaseAdmin, batida.offline_uuid);
  if (existente) {
    return { offline_uuid: batida.offline_uuid, status: "duplicado", batida_id: existente };
  }

  // Resolver CC
  const ccId = await resolverCentroCusto(supabaseAdmin, funcionarioId, batida.centro_custo_id);
  if (!ccId) {
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: "CC não identificado", codigo: "SEM_CC" };
  }

  const config = await carregarConfigCC(supabaseAdmin, ccId);

  // Divergência de relógio
  const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(batida.data_hora_dispositivo);
  const dataOperacional = calcularDataOperacional(dataHoraConsiderada);

  // Validar sequência (considera batidas já inseridas neste lote)
  const seq = await validarSequenciaBatidas(
    supabaseAdmin, funcionarioId, dataOperacional, batida.tipo_batida, batidasJaInseridas
  );
  if (!seq.valido) {
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: seq.erro!, codigo: "SEQUENCIA_INVALIDA" };
  }

  // Duplicata temporal
  const isDup = await verificarDuplicataTemporal(supabaseAdmin, funcionarioId, batida.tipo_batida, dataHoraConsiderada);
  if (isDup) {
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: "Duplicata temporal", codigo: "DUPLICATA_TEMPORAL" };
  }

  let statusValidacao = "valida";
  const justificativas: string[] = [];

  // Idade > 48h
  const idadeMs = Math.abs(Date.now() - new Date(batida.data_hora_dispositivo).getTime());
  if (idadeMs > 48 * 60 * 60 * 1000) {
    statusValidacao = "pendente_revisao";
    justificativas.push("Sincronização após 48h");
  }

  // Tentativa >= 3
  if (batida.tentativa_sync >= 3) {
    statusValidacao = "pendente_revisao";
    justificativas.push(`Tentativa de sync #${batida.tentativa_sync}`);
  }

  // GPS
  if (config.exige_gps && (batida.latitude == null || batida.longitude == null)) {
    statusValidacao = "pendente_revisao";
    justificativas.push("GPS não disponível");
  } else if (batida.precisao_gps_metros && batida.precisao_gps_metros > 100) {
    statusValidacao = "pendente_revisao";
    justificativas.push("Precisão GPS > 100m");
  }

  // Geofence
  let dentroRaio: boolean | null = null;
  let distanciaMetros: number | null = null;
  const geofence = await calcularGeofence(supabaseAdmin, batida.latitude, batida.longitude, ccId);
  if (geofence) {
    dentroRaio = geofence.dentroRaio;
    distanciaMetros = geofence.distanciaMetros;
    if (!geofence.dentroRaio) {
      if (!config.permite_ponto_fora_raio) {
        return { offline_uuid: batida.offline_uuid, status: "erro", erro: "Fora do raio permitido", codigo: "FORA_RAIO" };
      }
      statusValidacao = "pendente_revisao";
      justificativas.push(`Fora do raio: ${geofence.distanciaMetros}m`);
    }
  }

  // Velocidade impossível
  const velImpossivel = await verificarVelocidadeImpossivel(
    supabaseAdmin, funcionarioId, batida.latitude, batida.longitude, dataHoraConsiderada
  );
  if (velImpossivel) {
    statusValidacao = "pendente_revisao";
    justificativas.push("Velocidade de deslocamento impossível");
  }

  // Horário suspeito
  if (verificarHorarioSuspeito(dataHoraConsiderada)) {
    statusValidacao = "pendente_revisao";
    justificativas.push("Horário suspeito (00-04h)");
  }

  // Foto
  let fotoUrl: string | null = null;
  if (batida.foto_base64) {
    fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, batida.foto_base64);
    if (!fotoUrl && config.exige_foto) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Upload de foto falhou");
    }
  } else if (config.exige_foto) {
    statusValidacao = "pendente_revisao";
    justificativas.push("Foto não fornecida");
  }

  // INSERT
  const batidaRow = {
    funcionario_id: funcionarioId,
    centro_custo_id: ccId,
    dispositivo_id: null,
    tipo_batida: batida.tipo_batida,
    modo_registro: "pwa_pessoal",
    data_hora_dispositivo: batida.data_hora_dispositivo,
    data_hora_servidor: new Date().toISOString(),
    data_hora_considerada: dataHoraConsiderada,
    data_operacional: dataOperacional,
    latitude: batida.latitude,
    longitude: batida.longitude,
    precisao_gps_metros: batida.precisao_gps_metros,
    dentro_raio: dentroRaio,
    distancia_centro_metros: distanciaMetros,
    foto_url: fotoUrl,
    origem_dados: "offline_sync",
    offline_uuid: batida.offline_uuid,
    status_validacao: statusValidacao,
    status_sync: "sincronizado",
    justificativa: justificativas.length > 0 ? justificativas.join("; ") : null,
    ip_address: ip,
    user_agent: batida.user_agent || req.headers.get("user-agent"),
    device_fingerprint: batida.device_fingerprint,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .insert(batidaRow)
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const existente = await verificarDeduplicacao(supabaseAdmin, batida.offline_uuid);
      return { offline_uuid: batida.offline_uuid, status: "duplicado", batida_id: existente || undefined };
    }
    if (fotoUrl) await limparFotoOrfa(supabaseAdmin, fotoUrl);
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: "Erro ao inserir", codigo: "INSERT_FALHOU" };
  }

  // Auditoria
  await registrarAuditoria(supabaseAdmin, "bd_ponto_batidas", inserted.id, "INSERT", batidaRow, userId, ip);

  return { offline_uuid: batida.offline_uuid, status: "sincronizado", batida_id: inserted.id };
}
