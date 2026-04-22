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
  verificarTempoMinimoEntreBatidas,
  respostaErro,
  type AlertaPonto,
  type ScoreRiscoFlags,
} from "../_shared/ponto-helpers.ts";
import { validarPayloadRegistrarPonto } from "../_shared/ponto-validators.ts";

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
    // PASSO 3 — JWT
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

    // PASSO 3.5 — Feature Toggle
    const pontoAtivo = await verificarFeatureToggle(supabaseAdmin, "ponto_eletronico_ativo");
    if (!pontoAtivo) {
      const modoTeste = await verificarModoTeste(supabaseAdmin, user.id);
      if (!modoTeste) {
        console.log(`[registrar-ponto] Toggle OFF | userId=${user.id}`);
        return respostaErro(503, "toggle_desativado", "Módulo de ponto eletrônico ainda não está ativo");
      }
      console.log(`[registrar-ponto] Toggle OFF mas modo teste ativo | userId=${user.id}`);
    }

    // PASSO 4 — Identificar funcionário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("funcionario_id")
      .eq("id", user.id)
      .single();

    if (!profile?.funcionario_id) {
      return respostaErro(403, "funcionario_sem_vinculo", "Usuário sem vínculo de funcionário");
    }

    const funcionarioId = profile.funcionario_id;

    // PASSO 4.5 — Permissão explícita
    const temPermissao = await validarPermissao(supabaseAdmin, user.id, "ponto_registrar");
    if (!temPermissao) {
      return respostaErro(403, "sem_permissao", "Sem permissão para registrar ponto");
    }

    // PASSO 5 — Status do funcionário
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("status")
      .eq("id", funcionarioId)
      .single();

    if (!func || !["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return respostaErro(403, "funcionario_inativo", "Funcionário inativo");
    }

    // PASSO 6 — Validar payload
    const body = await req.json();
    const validacao = validarPayloadRegistrarPonto(body);
    if (!validacao.valido || !validacao.dados) {
      return respostaErro(400, "payload_invalido", validacao.erro || "Payload inválido");
    }
    const payload = validacao.dados;

    // PASSO 7 — Deduplicação offline
    const batidaExistente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
    if (batidaExistente) {
      return new Response(
        JSON.stringify({ success: true, duplicado: true, batida_id: batidaExistente }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 8 — Resolver centro de custo (HIERARQUIA DETERMINÍSTICA)
    // Prioridade: 1) CC formal do funcionário  2) Vínculo operacional ativo  3) GPS/payload (fallback)
    const ccPayload =
      typeof payload.centro_custo_id === "string" && payload.centro_custo_id.trim() !== ""
        ? payload.centro_custo_id.trim()
        : null;
    const ccGpsRef =
      typeof (payload as any).cc_gps_referencia_id === "string" &&
      (payload as any).cc_gps_referencia_id.trim() !== ""
        ? (payload as any).cc_gps_referencia_id.trim()
        : null;

    const { data: funcCC } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("centro_custo_id")
      .eq("id", funcionarioId)
      .single();
    const ccFuncionario =
      typeof funcCC?.centro_custo_id === "string" && funcCC.centro_custo_id.trim() !== ""
        ? funcCC.centro_custo_id.trim()
        : null;

    const { data: vinculoAtivo } = await supabaseAdmin
      .from("bd_ponto_vinculos_operacionais")
      .select("centro_custo_id")
      .eq("funcionario_id", funcionarioId)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    const ccVinculo =
      typeof vinculoAtivo?.centro_custo_id === "string" && vinculoAtivo.centro_custo_id.trim() !== ""
        ? vinculoAtivo.centro_custo_id.trim()
        : null;

    let ccId: string | null = null;
    let motivoCC = "nenhum";
    if (ccFuncionario) { ccId = ccFuncionario; motivoCC = "cc_funcionario"; }
    else if (ccVinculo) { ccId = ccVinculo; motivoCC = "vinculo_operacional"; }
    else if (ccPayload) {
      // fallback: payload (geralmente do totem ou modo legado)
      ccId = await resolverCentroCusto(supabaseAdmin, funcionarioId, ccPayload);
      motivoCC = ccId ? "payload_fallback" : "nenhum";
    } else if (ccGpsRef) {
      ccId = await resolverCentroCusto(supabaseAdmin, funcionarioId, ccGpsRef);
      motivoCC = ccId ? "gps_fallback" : "nenhum";
    }

    console.log("[PONTO][CC_DECISAO]", {
      funcionarioId,
      cc_funcionario: ccFuncionario,
      cc_vinculo: ccVinculo,
      cc_payload: ccPayload,
      cc_gps: ccGpsRef,
      ccFinal: ccId,
      motivo: motivoCC,
    });

    if (!ccId) {
      console.log("[PONTO][BLOQUEIO_CRITICO]", {
        funcionarioId, motivo: "cc_nao_resolvido",
        latitude: payload.latitude, longitude: payload.longitude,
      });
      return respostaErro(400, "centro_custo_nao_resolvido",
        "Funcionário sem centro de custo formal. Solicite vínculo ao RH.");
    }

    // PASSO 8.5 — Validar vínculo com CC final
    const temVinculo = await validarVinculoCC(supabaseAdmin, funcionarioId, ccId);
    if (!temVinculo) {
      console.log("[PONTO][BLOQUEIO]", {
        funcionarioId, motivo: "sem_vinculo", ccId,
        latitude: payload.latitude, longitude: payload.longitude,
      });
      return respostaErro(403, "funcionario_sem_vinculo_obra",
        "Funcionário não possui vínculo com este centro de custo");
    }

    // PASSO 9 — Config do CC
    const config = await carregarConfigCC(supabaseAdmin, ccId);

    // PASSO 9.5 — Bloqueio offline PWA
    const origemDados = payload.offline_uuid ? "offline_sync" : "online";
    if (origemDados === "offline_sync" && !config.permite_offline_pwa) {
      return respostaErro(403, "offline_nao_permitido", "Registro offline não permitido. Utilize conexão ou totem");
    }

    // PASSO 10 — Divergência de relógio
    const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(payload.data_hora_dispositivo);

    // PASSO 10.5 — Data operacional
    const dataOperacional = calcularDataOperacional(dataHoraConsiderada);

    // PASSO 10.6 — Tipo de dia
    const tipoRegistro = await verificarTipoDia(supabaseAdmin, dataOperacional, ccId);

    // PASSO 10.7 — Turno noturno
    const turnoNoturno = await verificarTurnoNoturno(supabaseAdmin, funcionarioId, ccId);

    // PASSO 11 — Sequência
    const seq = await validarSequenciaBatidas(supabaseAdmin, funcionarioId, dataOperacional, payload.tipo_batida);
    if (!seq.valido) {
      const motivo = seq.motivo || "sequencia_invalida";
      return respostaErro(422, motivo, seq.erro || "Sequência de batidas inválida", { batidas_dia: seq.batidasDia });
    }

    // PASSO 12 — Duplicata temporal
    const isDuplicata = await verificarDuplicataTemporal(
      supabaseAdmin, funcionarioId, payload.tipo_batida, dataHoraConsiderada
    );
    if (isDuplicata) {
      return respostaErro(429, "duplicata_temporal", "Batida duplicada. Aguarde 5 minutos.");
    }

    const minBatidas = await verificarTempoMinimoEntreBatidas(
      supabaseAdmin,
      funcionarioId,
      dataOperacional,
      dataHoraConsiderada,
      Math.max(config.tempo_min_entre_batidas_min ?? 10, 10),
    );
    if (!minBatidas.ok) {
      return respostaErro(
        429,
        "tempo_minimo_entre_batidas",
        "Aguarde antes de registrar novo ponto",
        { minutos_desde_ultima: minBatidas.deltaMin, minimo_min: Math.max(config.tempo_min_entre_batidas_min ?? 10, 10) }
      );
    }

    // Coletar alertas e status
    const alertas: AlertaPonto[] = [];
    let statusValidacao = "valida";
    const justificativas: string[] = [];

    // Flags para score de risco
    const scoreFlags: ScoreRiscoFlags = {
      foraRaio: false,
      semFoto: false,
      gpsImpreciso: false,
      divergenciaRelogio: flagDivergencia,
      offline: origemDados === "offline_sync",
    };

    if (flagDivergencia) {
      alertas.push({ tipo: "divergencia_relogio", mensagem: "Relógio do dispositivo diverge > 5min" });
    }

    // PASSO 13 — GPS (presença)
    if (config.exige_gps) {
      if (payload.latitude == null || payload.longitude == null) {
        statusValidacao = "pendente_revisao";
        justificativas.push("GPS não informado");
        alertas.push({ tipo: "sem_gps", mensagem: "GPS não disponível" });
        scoreFlags.gpsImpreciso = true;
      }
    }

    // VALIDAÇÃO DE PRECISÃO (SEMPRE, independente de exige_gps)
    if (payload.precisao_gps_metros != null) {
      if (payload.precisao_gps_metros > 150) {
        console.log("[PONTO][BLOQUEIO]", {
          funcionarioId,
          motivo: "gps_impreciso_bloqueante",
          precisao: payload.precisao_gps_metros,
          latitude: payload.latitude,
          longitude: payload.longitude,
        });
        return respostaErro(403, "gps_impreciso_bloqueante",
          "Precisão do GPS insuficiente para registrar o ponto",
          { precisao_metros: payload.precisao_gps_metros });
      } else if (payload.precisao_gps_metros > 80) {
        statusValidacao = "pendente_revisao";
        justificativas.push(`Precisão GPS intermediária: ${payload.precisao_gps_metros}m`);
        alertas.push({ tipo: "gps_impreciso", mensagem: `Precisão: ${payload.precisao_gps_metros}m` });
        scoreFlags.gpsImpreciso = true;
      }
    }

    // PASSO 14 — Geofence
    let dentroRaio: boolean | null = null;
    let distanciaMetros: number | null = null;
    console.log("[PONTO][CHECKPOINT_4] antes_geofence", { funcionarioId, ccId });
    const geofence = await calcularGeofence(supabaseAdmin, payload.latitude, payload.longitude, ccId);
    if (geofence) {
      dentroRaio = geofence.dentroRaio;
      distanciaMetros = geofence.distanciaMetros;
      if (!geofence.dentroRaio) {
        scoreFlags.foraRaio = true;

        if (config.modo_geofence === "restritivo") {
          return respostaErro(403, "fora_do_raio", "Fora do raio permitido", {
            distancia: geofence.distanciaMetros,
            raio: config.raio_metros,
          });
        }

        // flexivel: permite mas marca revisão
        statusValidacao = "pendente_revisao";
        justificativas.push(`Fora do raio: ${geofence.distanciaMetros}m`);
        alertas.push({ tipo: "fora_raio", mensagem: `Distância: ${geofence.distanciaMetros}m` });
      }
    }

    // PASSO 14.5 — Divergência entre CC do GPS e CC formal (sem bloqueio, só alerta/auditoria)
    if (ccGpsRef && ccGpsRef !== ccId) {
      console.log("[PONTO][CC_DIVERGENCIA_GPS]", {
        funcionarioId, ccFinal: ccId, cc_gps: ccGpsRef,
      });
      alertas.push({
        tipo: "divergencia_cc_gps",
        mensagem: "GPS sugeriu obra diferente do vínculo formal",
      });
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

    // PASSO 16 — Horário suspeito (respeitando turno noturno)
    if (verificarHorarioSuspeito(dataHoraConsiderada, turnoNoturno)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Horário suspeito (00-04h)");
      alertas.push({ tipo: "horario_suspeito", mensagem: "Registro entre 00:00 e 04:00" });
    }

    // PASSO 16.5 — Intervalo ausente na saída
    if (verificarIntervaloAusente(payload.tipo_batida, seq.batidasDia, config.intervalo_obrigatorio)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Saída sem intervalo registrado");
      alertas.push({ tipo: "sem_intervalo", mensagem: "Saída sem intervalo" });
    }

    // PASSO 16.6 — Auditoria dispositivo diferente (sem bloqueio)
    if (payload.device_fingerprint && seq.batidasDia.length > 0) {
      const { data: entradaDia } = await supabaseAdmin
        .from("bd_ponto_batidas")
        .select("device_fingerprint")
        .eq("funcionario_id", funcionarioId)
        .eq("data_operacional", dataOperacional)
        .eq("tipo_batida", "entrada")
        .neq("status_validacao", "invalidada")
        .limit(1)
        .maybeSingle();

      if (
        entradaDia?.device_fingerprint &&
        entradaDia.device_fingerprint !== payload.device_fingerprint
      ) {
        alertas.push({
          tipo: "dispositivo_diferente",
          mensagem: "Jornada registrada em dispositivos diferentes"
        });
        scoreFlags.dispositivoDiferente = true;

        console.log("[PONTO][ALERTA][DISPOSITIVO]", {
          funcionarioId,
          dataOperacional,
          device_atual: payload.device_fingerprint,
          device_entrada: entradaDia?.device_fingerprint
        });
      }
    }

    // PASSO 17 — Foto (obrigatória)
    if (!payload.foto_base64) {
      return respostaErro(403, "foto_obrigatoria", "Foto obrigatória para registro de ponto");
    }

    let fotoUrl: string | null = null;
    fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, payload.foto_base64);
    if (!fotoUrl) {
      return respostaErro(403, "foto_upload_falha", "Falha no upload da foto de evidência");
    }

    // PASSO 17.5 — Score de risco
    const scoreRisco = calcularScoreRisco(scoreFlags);
    if (scoreRisco >= 2 && statusValidacao === "valida") {
      statusValidacao = "pendente_revisao";
      justificativas.push(`Score de risco elevado: ${scoreRisco}`);
    }

    // PASSO 18 — INSERT
    console.log("[PONTO][CHECKPOINT_5] antes_insert", {
      funcionarioId,
      ccId,
      dentro_raio: dentroRaio,
      distancia_centro_metros: distanciaMetros,
    });
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
      origem_dados: origemDados,
      offline_uuid: payload.offline_uuid,
      status_validacao: statusValidacao,
      status_sync: "sincronizado",
      justificativa: justificativas.length > 0 ? justificativas.join("; ") : null,
      ip_address: ip,
      user_agent: payload.user_agent || req.headers.get("user-agent"),
      device_fingerprint: payload.device_fingerprint,
      tipo_registro: tipoRegistro,
      score_risco: scoreRisco,
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
          JSON.stringify({ success: true, duplicado: true, batida_id: existente }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (fotoUrl) {
        await limparFotoOrfa(supabaseAdmin, fotoUrl);
      }

      console.error("[registrar-ponto] INSERT falhou:", insertError);
      return respostaErro(500, "erro_inserir_batida", "Erro ao registrar batida");
    }

    // PASSO 19 — Auditoria
    await registrarAuditoria(
      supabaseAdmin, "bd_ponto_batidas", batida.id, "INSERT",
      batidaRow, user.id, ip
    );

    // PASSO 19.5 — Integração apontamento (entrada)
    if (payload.tipo_batida === "entrada") {
      await integrarApontamentoEquipe(
        supabaseAdmin, funcionarioId, ccId, dataOperacional, batida.id, dataHoraConsiderada
      );
    }

    // PASSO 19.6 — Integração diárias (presença_diaria + entrada)
    if (tipoRegistro === "presenca_diaria" && payload.tipo_batida === "entrada") {
      await integrarDiariaPresenca(
        supabaseAdmin, funcionarioId, ccId, dataOperacional, batida.id, dataHoraConsiderada
      );
    }

    console.log(
      `[registrar-ponto] OK func=${funcionarioId} tipo=${payload.tipo_batida} cc=${ccId} dist=${distanciaMetros ?? "N/A"}m status=${statusValidacao} tipoReg=${tipoRegistro} score=${scoreRisco}`
    );

    // PASSO 20 — Resposta
    return new Response(
      JSON.stringify({
        success: true,
        batida_id: batida.id,
        tipo_batida: payload.tipo_batida,
        data_hora_considerada: dataHoraConsiderada,
        data_operacional: dataOperacional,
        dentro_raio: dentroRaio,
        distancia_centro_metros: distanciaMetros,
        status_validacao: statusValidacao,
        tipo_registro: tipoRegistro,
        score_risco: scoreRisco,
        alertas,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[PONTO][FATAL]", { message: e?.message, stack: e?.stack, name: e?.name });
    return new Response(
      JSON.stringify({
        success: false,
        error: "erro_interno",
        message: e?.message || "Erro interno do servidor",
        stage: "catch_global",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
