import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  validarPermissao,
  calcularDataOperacional,
  verificarDivergenciaRelogio,
  resolverCentroCusto,
  validarVinculoCC,
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
  calcularScoreRisco,
  verificarTipoDia,
  verificarTurnoNoturno,
  verificarIntervaloAusente,
  integrarApontamentoEquipe,
  integrarDiariaPresenca,
  verificarFeatureToggle,
  verificarModoTeste,
  respostaErro,
  type ScoreRiscoFlags,
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
    return respostaErro(405, "metodo_nao_permitido", "Método não permitido");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ip = extrairIp(req);

  try {
    // Auth JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return respostaErro(401, "token_ausente", "Token não fornecido");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return respostaErro(401, "token_invalido", "Token inválido ou expirado");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Feature Toggle
    const pontoAtivo = await verificarFeatureToggle(supabaseAdmin, "ponto_eletronico_ativo");
    if (!pontoAtivo) {
      const modoTeste = await verificarModoTeste(supabaseAdmin, user.id);
      if (!modoTeste) {
        console.log(`[sync-ponto-offline] Toggle OFF | userId=${user.id}`);
        return respostaErro(503, "toggle_desativado", "Módulo de ponto eletrônico ainda não está ativo");
      }
      console.log(`[sync-ponto-offline] Toggle OFF mas modo teste ativo | userId=${user.id}`);
    }

    // Identificar funcionário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("funcionario_id")
      .eq("id", user.id)
      .single();

    if (!profile?.funcionario_id) {
      return respostaErro(403, "funcionario_sem_vinculo", "Usuário sem vínculo de funcionário");
    }
    const funcionarioId = profile.funcionario_id;

    // Permissão
    const temPermissao = await validarPermissao(supabaseAdmin, user.id, "ponto_registrar");
    if (!temPermissao) {
      return respostaErro(403, "sem_permissao", "Sem permissão para registrar ponto");
    }

    // Status funcionário
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("status")
      .eq("id", funcionarioId)
      .single();

    if (!func || !["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return respostaErro(403, "funcionario_inativo", "Funcionário inativo");
    }

    // Validar payload
    const body = await req.json();
    const validacao = validarPayloadSyncOffline(body);
    if (!validacao.valido || !validacao.dados) {
      return respostaErro(400, "payload_invalido", validacao.erro || "Payload inválido");
    }

    // Ordenar cronologicamente
    const batidasOrdenadas = [...validacao.dados.batidas].sort(
      (a, b) => new Date(a.data_hora_dispositivo).getTime() - new Date(b.data_hora_dispositivo).getTime()
    );

    const resultados: ResultadoBatida[] = [];
    const batidasInseridas: string[] = [];
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
          codigo: "erro_interno",
        });
      }
    }

    console.log(
      `[sync-offline] LOTE func=${funcionarioId} total=${batidasOrdenadas.length} ok=${sincronizados} dup=${duplicados} err=${resultados.filter(r => r.status === "erro").length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        total: batidasOrdenadas.length,
        sincronizados,
        duplicados,
        erros: resultados.filter((r) => r.status === "erro"),
        resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[sync-offline] Erro geral:", e?.message || e);
    return respostaErro(500, "erro_interno", "Erro interno do servidor");
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

  console.log("[PONTO][CHECKPOINT_CC]", { funcionarioId, ccId });

  if (!ccId || typeof ccId !== "string" || ccId.trim() === "") {
    console.log("[PONTO][BLOQUEIO_CRITICO]", {
      funcionarioId,
      motivo: "cc_invalido",
      ccId,
      latitude: batida.latitude,
      longitude: batida.longitude,
    });
    return { offline_uuid: batida.offline_uuid, status: "erro",
      erro: "Centro de custo não identificado",
      codigo: "centro_custo_nao_resolvido" };
  }

  console.log("[PONTO][DEBUG_CC]", {
    funcionarioId,
    ccId_recebido: batida.centro_custo_id,
    ccId_resolvido: ccId,
  });

  // Validar vínculo com CC
  const temVinculo = await validarVinculoCC(supabaseAdmin, funcionarioId, ccId);
  if (!temVinculo) {
    console.log("[PONTO][BLOQUEIO]", {
      funcionarioId, motivo: "sem_vinculo", ccId,
      latitude: batida.latitude, longitude: batida.longitude,
    });
    return {
      offline_uuid: batida.offline_uuid, status: "erro",
      erro: "Sem vínculo com este centro de custo", codigo: "funcionario_sem_vinculo_obra",
    };
  }

  const config = await carregarConfigCC(supabaseAdmin, ccId);

  // Bloqueio offline PWA
  if (!config.permite_offline_pwa) {
    return {
      offline_uuid: batida.offline_uuid,
      status: "erro",
      erro: "Registro offline não permitido. Utilize conexão ou totem",
      codigo: "offline_nao_permitido",
    };
  }

  // Divergência de relógio
  const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(batida.data_hora_dispositivo);
  const dataOperacional = calcularDataOperacional(dataHoraConsiderada);

  // Tipo de dia + turno noturno
  const tipoRegistro = await verificarTipoDia(supabaseAdmin, dataOperacional, ccId);
  const turnoNoturno = await verificarTurnoNoturno(supabaseAdmin, funcionarioId, ccId);

  // Validar sequência
  const seq = await validarSequenciaBatidas(
    supabaseAdmin, funcionarioId, dataOperacional, batida.tipo_batida, batidasJaInseridas
  );
  if (!seq.valido) {
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: seq.erro!, codigo: seq.motivo || "sequencia_invalida" };
  }

  // Duplicata temporal
  const isDup = await verificarDuplicataTemporal(supabaseAdmin, funcionarioId, batida.tipo_batida, dataHoraConsiderada);
  if (isDup) {
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: "Duplicata temporal", codigo: "duplicata_temporal" };
  }

  let statusValidacao = "pendente_revisao";
  const justificativas: string[] = ["Sincronização offline"];

  const scoreFlags: ScoreRiscoFlags = {
    foraRaio: false,
    semFoto: false,
    gpsImpreciso: false,
    divergenciaRelogio: flagDivergencia,
    offline: true,
  };

  // Idade > 48h
  const idadeMs = Math.abs(Date.now() - new Date(batida.data_hora_dispositivo).getTime());
  if (idadeMs > 48 * 60 * 60 * 1000) {
    justificativas.push("Sincronização após 48h");
  }

  // Tentativa >= 3
  if (batida.tentativa_sync >= 3) {
    justificativas.push(`Tentativa de sync #${batida.tentativa_sync}`);
  }

  // GPS (presença)
  if (config.exige_gps && (batida.latitude == null || batida.longitude == null)) {
    justificativas.push("GPS não informado");
    scoreFlags.gpsImpreciso = true;
  }

  // VALIDAÇÃO DE PRECISÃO (SEMPRE, independente de exige_gps)
  if (batida.precisao_gps_metros != null) {
    if (batida.precisao_gps_metros > 150) {
      console.log("[SYNC][BLOQUEIO]", {
        funcionarioId,
        motivo: "gps_impreciso_bloqueante",
        precisao: batida.precisao_gps_metros,
        latitude: batida.latitude,
        longitude: batida.longitude,
      });
      return {
        offline_uuid: batida.offline_uuid,
        status: "erro",
        erro: "Precisão do GPS insuficiente para registrar o ponto",
        codigo: "gps_impreciso_bloqueante",
      };
    } else if (batida.precisao_gps_metros > 80) {
      justificativas.push(`Precisão GPS intermediária: ${batida.precisao_gps_metros}m`);
      scoreFlags.gpsImpreciso = true;
    }
  }

  // Geofence
  let dentroRaio: boolean | null = null;
  let distanciaMetros: number | null = null;
  const geofence = await calcularGeofence(supabaseAdmin, batida.latitude, batida.longitude, ccId);
  if (geofence) {
    dentroRaio = geofence.dentroRaio;
    distanciaMetros = geofence.distanciaMetros;
    if (!geofence.dentroRaio) {
      scoreFlags.foraRaio = true;

      if (config.modo_geofence === "restritivo") {
        return { offline_uuid: batida.offline_uuid, status: "erro", erro: "Fora do raio permitido", codigo: "fora_do_raio" };
      }

      justificativas.push(`Fora do raio: ${geofence.distanciaMetros}m`);
    }
  }

  // Velocidade impossível
  const velImpossivel = await verificarVelocidadeImpossivel(
    supabaseAdmin, funcionarioId, batida.latitude, batida.longitude, dataHoraConsiderada
  );
  if (velImpossivel) {
    justificativas.push("Velocidade de deslocamento impossível");
  }

  // Horário suspeito
  if (verificarHorarioSuspeito(dataHoraConsiderada, turnoNoturno)) {
    justificativas.push("Horário suspeito (00-04h)");
  }

  // Intervalo ausente
  if (verificarIntervaloAusente(batida.tipo_batida, seq.batidasDia, config.intervalo_obrigatorio)) {
    justificativas.push("Saída sem intervalo registrado");
  }

  // Foto (obrigatória)
  if (!batida.foto_base64) {
    return {
      offline_uuid: batida.offline_uuid,
      status: "erro",
      erro: "Foto obrigatória para registro de ponto",
      codigo: "foto_obrigatoria",
    };
  }

  let fotoUrl: string | null = null;
  fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, batida.foto_base64);
  if (!fotoUrl) {
    return {
      offline_uuid: batida.offline_uuid,
      status: "erro",
      erro: "Falha no upload da foto de evidência",
      codigo: "foto_upload_falha",
    };
  }

  // Score de risco
  const scoreRisco = calcularScoreRisco(scoreFlags);

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
    tipo_registro: tipoRegistro,
    score_risco: scoreRisco,
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
    return { offline_uuid: batida.offline_uuid, status: "erro", erro: "Erro ao inserir", codigo: "erro_inserir_batida" };
  }

  // Auditoria
  await registrarAuditoria(supabaseAdmin, "bd_ponto_batidas", inserted.id, "INSERT", batidaRow, userId, ip);

  // Integração apontamento (entrada)
  if (batida.tipo_batida === "entrada") {
    await integrarApontamentoEquipe(
      supabaseAdmin, funcionarioId, ccId, dataOperacional, inserted.id, dataHoraConsiderada
    );
  }

  // Integração diárias (presença_diaria + entrada)
  if (tipoRegistro === "presenca_diaria" && batida.tipo_batida === "entrada") {
    await integrarDiariaPresenca(
      supabaseAdmin, funcionarioId, ccId, dataOperacional, inserted.id, dataHoraConsiderada
    );
  }

  return { offline_uuid: batida.offline_uuid, status: "sincronizado", batida_id: inserted.id };
}
