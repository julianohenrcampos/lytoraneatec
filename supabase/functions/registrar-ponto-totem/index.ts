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
  calcularScoreRisco,
  verificarTipoDia,
  verificarTurnoNoturno,
  verificarIntervaloAusente,
  integrarApontamentoEquipe,
  integrarDiariaPresenca,
  verificarFeatureToggle,
  verificarTempoMinimoEntreBatidas,
  verificarMinimoParaIntervalo,
  verificarSaidaAntecipada,
  gerarIntervaloAutomatico,
  haversineMetros,
  respostaErro,
  type AlertaPonto,
  type ScoreRiscoFlags,
} from "../_shared/ponto-helpers.ts";
import { validarPayloadTotem } from "../_shared/ponto-validators.ts";
import { integrarDiariaSeAtivado } from "../_shared/integracao-diaria.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respostaErro(405, "metodo_nao_permitido", "Método não permitido");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ip = extrairIp(req);

  try {
    // PASSO 3 — Autenticação: x-device-secret OU x-api-key global
    const apiKey = req.headers.get("x-api-key");
    const deviceSecretHeader = req.headers.get("x-device-secret");
    const expectedApiKey = Deno.env.get("LYTOTEC_API_KEY");

    if (!deviceSecretHeader && !apiKey) {
      return respostaErro(401, "auth_ausente", "Forneça x-device-secret (totem) ou x-api-key", "auth");
    }
    if (!deviceSecretHeader && apiKey && apiKey !== expectedApiKey) {
      return respostaErro(401, "api_key_invalida", "API key inválida", "auth");
    }

    // PASSO 4 — Validar payload
    const body = await req.json();
    console.log("[PONTO][START]", {
      codigo: body?.codigo_dispositivo,
      tipo: body?.tipo_batida,
      temFoto: !!body?.foto_base64,
      temIdent: !!body?.identificador_funcionario,
    });
    const validacao = validarPayloadTotem(body);
    if (!validacao.valido || !validacao.dados) {
      return respostaErro(400, "payload_invalido", validacao.erro || "Payload inválido", "payload");
    }
    const payload = validacao.dados;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // PASSO 4.5 — Feature Toggle
    const pontoAtivo = await verificarFeatureToggle(supabaseAdmin, "ponto_eletronico_ativo");
    if (!pontoAtivo) {
      console.log(`[registrar-ponto-totem] Toggle OFF | dispositivo=${payload.codigo_dispositivo}`);
      return respostaErro(503, "toggle_desativado", "Módulo de ponto eletrônico ainda não está ativo", "feature_toggle");
    }

    // PASSO 5 — Validar dispositivo
    const dispResult = await validarDispositivoTotem(supabaseAdmin, payload.codigo_dispositivo, deviceSecretHeader);
    if (!dispResult.valido) {
      return respostaErro(dispResult.status!, "dispositivo_invalido", dispResult.erro || "Dispositivo inválido", "dispositivo");
    }
    const dispositivo = dispResult.dispositivo!;
    console.log("[PONTO][DEVICE]", { id: dispositivo.id, cc: dispositivo.centro_custo_id });

    // PASSO 5.1 — Carregar lista N:N de CCs autorizados do dispositivo
    const { data: ccsRows } = await supabaseAdmin
      .from("bd_ponto_dispositivo_centros_custo")
      .select("centro_custo_id")
      .eq("dispositivo_id", dispositivo.id)
      .eq("ativo", true);

    let ccsAutorizados: string[] = (ccsRows ?? [])
      .map((r: any) => r.centro_custo_id)
      .filter(Boolean);
    if (ccsAutorizados.length === 0 && dispositivo.centro_custo_id) {
      ccsAutorizados = [dispositivo.centro_custo_id];
    }
    console.log("[PONTO][CCS_DISPOSITIVO]", {
      dispositivo_id: dispositivo.id,
      ccsAutorizados,
    });

    // PASSO 6 — Identificar funcionário
    if (!payload.identificador_funcionario) {
      return respostaErro(400, "identificador_ausente", "Funcionário sem matrícula/CPF para identificação", "payload");
    }
    const campo = payload.tipo_identificador === "cpf" ? "cpf" : "matricula";
    const { data: func } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("id, status, centro_custo_id")
      .eq(campo, payload.identificador_funcionario)
      .single();

    if (!func) {
      return respostaErro(404, "funcionario_nao_encontrado", "Funcionário não encontrado", "funcionario");
    }

    if (!["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return respostaErro(403, "funcionario_inativo", "Funcionário inativo", "funcionario");
    }

    const funcionarioId = func.id;
    console.log("[PONTO][FUNCIONARIO]", { id: funcionarioId, status: func.status, cc: func.centro_custo_id });

    // PASSO 7 — Deduplicação offline
    const batidaExistente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
    if (batidaExistente) {
      return new Response(
        JSON.stringify({ success: true, duplicado: true, batida_id: batidaExistente }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PASSO 8 — Verificar vínculo com qualquer CC autorizado do dispositivo (N:N)
    const ccsFiltro = ccsAutorizados.length > 0
      ? ccsAutorizados
      : ["00000000-0000-0000-0000-000000000000"];

    const { data: vinculo } = await supabaseAdmin
      .from("bd_ponto_vinculos_operacionais")
      .select("id, centro_custo_id")
      .eq("funcionario_id", funcionarioId)
      .eq("ativo", true)
      .in("centro_custo_id", ccsFiltro);

    const temVinculoDireto = !!vinculo && vinculo.length > 0;
    const temVinculoFallback =
      !!func.centro_custo_id && ccsAutorizados.includes(func.centro_custo_id);

    console.log("[PONTO][VINCULO_DEBUG]", {
      funcionario_id: funcionarioId,
      funcionario_cc: func.centro_custo_id,
      dispositivo_id: dispositivo.id,
      dispositivo_ccs: ccsAutorizados,
      temVinculoDireto,
      temVinculoFallback,
    });

    if (!temVinculoDireto && !temVinculoFallback) {
      console.log("[PONTO][BLOQUEIO]", {
        funcionarioId,
        motivo: "sem_vinculo_obra",
        funcionario_cc: func.centro_custo_id,
        dispositivo_ccs: ccsAutorizados,
      });
      return respostaErro(
        403,
        "funcionario_sem_vinculo_obra",
        "Funcionário sem vínculo com esta obra",
        "vinculo",
        { funcionario_cc: func.centro_custo_id, dispositivo_ccs: ccsAutorizados }
      );
    }

    // CC base (sem GPS) — fallback enquanto geofence ainda não foi avaliado
    const ccBatida =
      (func.centro_custo_id && ccsAutorizados.includes(func.centro_custo_id) && func.centro_custo_id) ||
      (vinculo?.[0]?.centro_custo_id) ||
      ccsAutorizados[0];

    // PASSO 9 — Config do CC
    const config = await carregarConfigCC(supabaseAdmin, ccBatida);

    // PASSO 10 — Divergência de relógio
    const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(payload.data_hora_dispositivo);
    const dataOperacional = calcularDataOperacional(dataHoraConsiderada);

    // PASSO 10.5 — Tipo de dia + turno noturno
    const tipoRegistro = await verificarTipoDia(supabaseAdmin, dataOperacional, ccBatida);
    const turnoNoturno = await verificarTurnoNoturno(supabaseAdmin, funcionarioId, ccBatida);
    console.log("[PONTO][TIPO_REGISTRO]", { tipoRegistro, turnoNoturno, dataOperacional });

    // PASSO 11 — Sequência
    const seq = await validarSequenciaBatidas(supabaseAdmin, funcionarioId, dataOperacional, payload.tipo_batida);
    if (!seq.valido) {
      return respostaErro(422, "sequencia_invalida", seq.erro || "Sequência de batidas inválida", "sequencia", { batidas_dia: seq.batidasDia });
    }

    // PASSO 11.1 — CLT: mínimo de 4h trabalhadas para iniciar intervalo
    if (payload.tipo_batida === "intervalo_inicio") {
      const minIntv = await verificarMinimoParaIntervalo(
        supabaseAdmin, funcionarioId, dataOperacional, dataHoraConsiderada, config.tempo_min_para_intervalo_min
      );
      if (!minIntv.ok) {
        const horas = (config.tempo_min_para_intervalo_min / 60).toFixed(0);
        return respostaErro(
          422,
          "intervalo_antes_minimo",
          `Intervalo só permitido após ${horas}h de trabalho`,
          "sequencia",
          { minutos_trabalhados: minIntv.minutosTrabalhados, minimo_min: config.tempo_min_para_intervalo_min }
        );
      }
    }

    // PASSO 12 — Duplicata temporal (mesmo tipo, < 5min)
    const isDup = await verificarDuplicataTemporal(supabaseAdmin, funcionarioId, payload.tipo_batida, dataHoraConsiderada);
    if (isDup) {
      return respostaErro(429, "duplicata_temporal", "Mesmo tipo de batida em menos de 5 minutos", "duplicata");
    }

    // PASSO 12.1 — CLT: tempo mínimo entre quaisquer batidas
    const minBatidas = await verificarTempoMinimoEntreBatidas(
      supabaseAdmin, funcionarioId, dataOperacional, dataHoraConsiderada, Math.max(config.tempo_min_entre_batidas_min ?? 10, 10)
    );
    if (!minBatidas.ok) {
      return respostaErro(
        429,
        "tempo_minimo_entre_batidas",
        "Aguarde antes de registrar novo ponto",
        "intervalo_minimo",
        { minutos_desde_ultima: minBatidas.deltaMin, minimo_min: Math.max(config.tempo_min_entre_batidas_min ?? 10, 10) }
      );
    }

    const alertas: AlertaPonto[] = [];
    let statusValidacao = "valida";
    const justificativas: string[] = [];

    // Score flags
    const scoreFlags: ScoreRiscoFlags = {
      foraRaio: false,
      semFoto: false,
      gpsImpreciso: false,
      divergenciaRelogio: flagDivergencia,
      offline: false,
    };

    if (flagDivergencia) {
      alertas.push({ tipo: "divergencia_relogio", mensagem: "Relógio diverge > 5min" });
    }

    // PASSO 12.5 — Geofence real (GPS do tablet vs CCs autorizados)
    console.log("[PONTO][GPS_RECEBIDO]", {
      lat: payload.latitude,
      lng: payload.longitude,
      precisao: payload.precisao_gps_metros,
    });

    let dentroRaio: boolean | null = null;
    let distanciaMin: number | null = null;
    let ccBatidaGeo: string | null = null;
    let raioCCVencedor: number | null = null;

    if (payload.latitude == null || payload.longitude == null) {
      scoreFlags.gpsImpreciso = true;
      alertas.push({ tipo: "sem_localizacao", mensagem: "GPS não disponível" });
    } else {
      if (payload.precisao_gps_metros != null && payload.precisao_gps_metros > 50) {
        scoreFlags.gpsImpreciso = true;
        alertas.push({
          tipo: "baixa_precisao",
          mensagem: `Precisão de GPS > 50m (${Math.round(payload.precisao_gps_metros)}m)`,
        });
      }

      const { data: ccsCoords } = await supabaseAdmin
        .from("bd_centros_custo")
        .select("id, latitude, longitude, raio_ponto_metros")
        .in("id", ccsAutorizados);

      let melhor: { id: string; dist: number; raio: number } | null = null;
      for (const cc of (ccsCoords ?? []) as any[]) {
        if (cc.latitude == null || cc.longitude == null) continue;
        const dist = haversineMetros(payload.latitude, payload.longitude, cc.latitude, cc.longitude);
        const raio = cc.raio_ponto_metros ?? config.raio_metros;
        if (!melhor || dist < melhor.dist) {
          melhor = { id: cc.id, dist, raio };
        }
      }

      if (melhor) {
        distanciaMin = Math.round(melhor.dist);
        raioCCVencedor = melhor.raio;
        dentroRaio = melhor.dist <= melhor.raio;
        if (dentroRaio) {
          ccBatidaGeo = melhor.id;
        }
      }

      console.log("[PONTO][GEOFENCE]", {
        ccVencedor: melhor?.id ?? null,
        distanciaMin,
        raio: raioCCVencedor,
        dentroRaio,
      });

      if (dentroRaio === false) {
        scoreFlags.foraRaio = true;
        alertas.push({
          tipo: "fora_raio",
          mensagem: `Fora do raio do CC mais próximo (${distanciaMin}m, raio ${raioCCVencedor}m)`,
        });
        if (config.permite_ponto_fora_raio === false && config.modo_geofence === "restritivo") {
          return respostaErro(
            403,
            "fora_raio",
            `Fora do raio permitido (${distanciaMin}m). Aproxime-se do local de trabalho.`,
            "geofence",
            { distancia_metros: distanciaMin, raio_metros: raioCCVencedor }
          );
        }
        // Modo flexível: marca pendente_revisao
        statusValidacao = "pendente_revisao";
        justificativas.push(`Registro fora do raio (${distanciaMin}m)`);
      }
    }

    // Hierarquia OBRIGATÓRIA do CC da batida:
    // 1) CC do funcionário, se autorizado no dispositivo
    // 2) CC do vínculo operacional ativo
    // 3) (fallback) CC mais próximo via GPS dentro do raio
    // 4) Primeiro CC autorizado do dispositivo
    let ccBatidaFinal: string;
    let motivoCC: "funcionario_cc" | "vinculo_operacional" | "gps_proximo" | "primeiro_cc_dispositivo";

    if (func.centro_custo_id && ccsAutorizados.includes(func.centro_custo_id)) {
      ccBatidaFinal = func.centro_custo_id;
      motivoCC = "funcionario_cc";
    } else if (vinculo?.[0]?.centro_custo_id) {
      ccBatidaFinal = vinculo[0].centro_custo_id;
      motivoCC = "vinculo_operacional";
    } else if (ccBatidaGeo) {
      ccBatidaFinal = ccBatidaGeo;
      motivoCC = "gps_proximo";
    } else {
      ccBatidaFinal = ccsAutorizados[0];
      motivoCC = "primeiro_cc_dispositivo";
    }

    console.log("[PONTO][CC_DECISAO]", {
      funcionario_id: funcionarioId,
      funcionario_cc: func.centro_custo_id,
      dispositivo_ccs: ccsAutorizados,
      vinculo_cc: vinculo?.[0]?.centro_custo_id ?? null,
      ccBatidaGeo,
      distanciaMin,
      raioCCVencedor,
      dentroRaio,
      ccFinal: ccBatidaFinal,
      motivo: motivoCC,
    });

    if (ccBatidaGeo && ccBatidaGeo !== ccBatidaFinal) {
      alertas.push({
        tipo: "cc_divergente_gps",
        mensagem: "GPS sugeriu CC diferente do vínculo do funcionário",
      });
    }

    // PASSO 13 — Horário suspeito (respeitando turno noturno)
    if (verificarHorarioSuspeito(dataHoraConsiderada, turnoNoturno)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Horário suspeito (00-04h)");
      alertas.push({ tipo: "horario_suspeito", mensagem: "Registro entre 00:00 e 04:00" });
    }

    // Velocidade impossível (usa GPS real do dispositivo quando disponível, senão lat/lng fixos)
    const latVel = payload.latitude ?? dispositivo.latitude_fixa;
    const lngVel = payload.longitude ?? dispositivo.longitude_fixa;
    if (latVel != null && lngVel != null) {
      const velImpossivel = await verificarVelocidadeImpossivel(
        supabaseAdmin, funcionarioId, latVel, lngVel, dataHoraConsiderada
      );
      if (velImpossivel) {
        statusValidacao = "pendente_revisao";
        justificativas.push("Velocidade de deslocamento impossível");
        alertas.push({ tipo: "velocidade_impossivel", mensagem: "Deslocamento suspeito" });
      }
    }

    // PASSO 13.5 — Saída antecipada (informativo) e intervalo automático CLT
    if (payload.tipo_batida === "saida") {
      // Saída antecipada (< 4h)
      const saidaAnt = await verificarSaidaAntecipada(
        supabaseAdmin, funcionarioId, dataOperacional, dataHoraConsiderada, 240
      );
      if (saidaAnt.antecipada) {
        statusValidacao = "pendente_revisao";
        justificativas.push(`Jornada incompleta (${saidaAnt.minutosTrabalhados} min trabalhados)`);
        alertas.push({ tipo: "jornada_incompleta", mensagem: "Saída antes de 4h" });
      }

      // Intervalo automático: jornada >= X min e sem intervalo registrado
      const temIntervalo =
        seq.batidasDia.includes("intervalo_inicio") && seq.batidasDia.includes("intervalo_fim");
      if (!temIntervalo) {
        // Calcula jornada total a partir da entrada
        const entradaCheck = await verificarSaidaAntecipada(
          supabaseAdmin, funcionarioId, dataOperacional, dataHoraConsiderada, 0
        );
        const jornadaMin = entradaCheck.minutosTrabalhados ?? 0;
        if (jornadaMin >= config.jornada_para_intervalo_min) {
          const res = await gerarIntervaloAutomatico(supabaseAdmin, {
            funcionarioId,
            centroCustoId: ccBatidaFinal,
            dispositivoId: dispositivo.id,
            dataOperacional,
            dataHoraSaida: dataHoraConsiderada,
            intervaloInicioHHMM: config.intervalo_padrao_inicio,
            intervaloMinutos: config.intervalo_padrao_min,
            tipoRegistro,
          });
          if (res.criadas > 0) {
            statusValidacao = "pendente_revisao";
            justificativas.push("Intervalo automático CLT inserido");
            alertas.push({
              tipo: "intervalo_automatico",
              mensagem: `Intervalo de ${config.intervalo_padrao_min} min inserido automaticamente`,
            });
          }
        } else if (config.intervalo_obrigatorio) {
          // Mantém comportamento legado: marca pendente sem inserir
          if (verificarIntervaloAusente(payload.tipo_batida, seq.batidasDia, config.intervalo_obrigatorio)) {
            statusValidacao = "pendente_revisao";
            justificativas.push("Saída sem intervalo registrado");
            alertas.push({ tipo: "sem_intervalo", mensagem: "Saída sem intervalo" });
          }
        }
      }
    }

    // PASSO 14 — Foto (obrigatória)
    if (!payload.foto_base64) {
      return respostaErro(403, "foto_obrigatoria", "Foto obrigatória para registro de ponto", "foto");
    }

    let fotoUrl: string | null = null;
    fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, payload.foto_base64);
    if (!fotoUrl) {
      return respostaErro(403, "foto_upload_falha", "Falha no upload da foto de evidência", "foto");
    }

    // PASSO 14.5 — Score de risco
    const scoreRisco = calcularScoreRisco(scoreFlags);
    if (scoreRisco >= 2 && statusValidacao === "valida") {
      statusValidacao = "pendente_revisao";
      justificativas.push(`Score de risco elevado: ${scoreRisco}`);
    }

    // PASSO 15 — INSERT
    const batidaRow = {
      funcionario_id: funcionarioId,
      centro_custo_id: ccBatidaFinal,
      dispositivo_id: dispositivo.id,
      tipo_batida: payload.tipo_batida,
      modo_registro: "totem",
      data_hora_dispositivo: payload.data_hora_dispositivo,
      data_hora_servidor: new Date().toISOString(),
      data_hora_considerada: dataHoraConsiderada,
      data_operacional: dataOperacional,
      latitude: payload.latitude,
      longitude: payload.longitude,
      precisao_gps_metros: payload.precisao_gps_metros,
      dentro_raio: dentroRaio,
      distancia_centro_metros: distanciaMin,
      foto_url: fotoUrl,
      origem_dados: "online",
      offline_uuid: payload.offline_uuid,
      status_validacao: statusValidacao,
      status_sync: "sincronizado",
      justificativa: justificativas.length > 0 ? justificativas.join("; ") : null,
      ip_address: ip,
      user_agent: null,
      device_fingerprint: null,
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
      if (fotoUrl) await limparFotoOrfa(supabaseAdmin, fotoUrl);
      console.error("[registrar-ponto-totem] INSERT falhou:", insertError);
      return respostaErro(500, "erro_inserir_batida", insertError.message || "Erro ao registrar batida", "insert");
    }

    // PASSO 16 — Auditoria
    await registrarAuditoria(supabaseAdmin, "bd_ponto_batidas", batida.id, "INSERT", batidaRow, null, ip);

    // PASSO 16.1 — Hook Ponto → Diária (Fase A.2) gated por CC. Não bloqueante.
    await integrarDiariaSeAtivado(supabaseAdmin, {
      id: batida.id,
      centro_custo_id: ccBatidaFinal,
      data_operacional: dataOperacional,
    });

    // PASSO 16.5 — Integração apontamento (entrada)
    if (payload.tipo_batida === "entrada") {
      await integrarApontamentoEquipe(
        supabaseAdmin, funcionarioId, ccBatidaFinal, dataOperacional, batida.id, dataHoraConsiderada
      );
    }

    // PASSO 16.6 — Integração diárias (presença_diaria + entrada)
    if (tipoRegistro === "presenca_diaria" && payload.tipo_batida === "entrada") {
      await integrarDiariaPresenca(
        supabaseAdmin, funcionarioId, ccBatidaFinal, dataOperacional, batida.id, dataHoraConsiderada
      );
    }

    // PASSO 16.7 — Integração automática Ponto → Diária (Fase 1) — não bloqueante
    // Controlada por feature flag em bd_configuracoes_sistema.
    let integracao_diaria: any = null;
    try {
      let integracaoAtiva = false;
      try {
        const { data: flagValor } = await supabaseAdmin.rpc(
          "get_configuracao_sistema",
          { p_chave: "ponto_integracao_diaria_ativa" }
        );
        integracaoAtiva = flagValor === "true";
      } catch (flagErr) {
        console.error("[PONTO][INTEGRACAO_DIARIA_FLAG_ERRO]", flagErr);
        integracaoAtiva = false; // fail-safe: OFF
      }

      if (!integracaoAtiva) {
        console.log("[PONTO][INTEGRACAO_DIARIA] DESATIVADA");
        integracao_diaria = { status: "desativada" };
      } else {
        try {
          const { data: integ, error: integErr } = await supabaseAdmin.rpc(
            "integrar_ponto_com_diaria",
            { p_batida_id: batida.id }
          );
          if (integErr) {
            console.error("[PONTO][INTEGRACAO_DIARIA_ERRO]", integErr);
            integracao_diaria = { status: "erro", motivo: integErr.message };
          } else {
            integracao_diaria = integ;
            console.log("[PONTO][INTEGRACAO_DIARIA]", { batida_id: batida.id, ...(integ as any) });
          }
        } catch (e: any) {
          console.error("[PONTO][INTEGRACAO_DIARIA_ERRO]", e);
          integracao_diaria = { status: "erro", motivo: e?.message };
        }
      }
    } catch (eOuter: any) {
      console.error("[PONTO][INTEGRACAO_DIARIA_OUTER_ERRO]", eOuter);
      integracao_diaria = { status: "erro", motivo: eOuter?.message };
    }

    console.log(
      `[registrar-ponto-totem] OK func=${funcionarioId} tipo=${payload.tipo_batida} disp=${payload.codigo_dispositivo} tipoReg=${tipoRegistro} score=${scoreRisco}`
    );

    // PASSO 17 — Resposta
    return new Response(
      JSON.stringify({
        success: true,
        batida_id: batida.id,
        tipo_batida: payload.tipo_batida,
        data_hora_considerada: dataHoraConsiderada,
        data_operacional: dataOperacional,
        dentro_raio: dentroRaio,
        distancia_centro_metros: distanciaMin,
        gps_precisao_m: payload.precisao_gps_metros,
        status_validacao: statusValidacao,
        tipo_registro: tipoRegistro,
        score_risco: scoreRisco,
        alertas,
        integracao_diaria,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[PONTO][FATAL]", {
      message: e?.message,
      stack: e?.stack,
      name: e?.name,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: "erro_interno",
        message: e?.message || "Erro interno do servidor",
        stage: "catch_global",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
