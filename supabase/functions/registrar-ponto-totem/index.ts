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
  respostaErro,
  type AlertaPonto,
  type ScoreRiscoFlags,
} from "../_shared/ponto-helpers.ts";
import { validarPayloadTotem } from "../_shared/ponto-validators.ts";

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
    // PASSO 3 — API Key global
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("LYTOTEC_API_KEY");
    if (!apiKey || apiKey !== expectedApiKey) {
      return respostaErro(401, "api_key_invalida", "API key inválida");
    }

    // PASSO 4 — Validar payload
    const body = await req.json();
    const validacao = validarPayloadTotem(body);
    if (!validacao.valido || !validacao.dados) {
      return respostaErro(400, "payload_invalido", validacao.erro || "Payload inválido");
    }
    const payload = validacao.dados;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // PASSO 4.5 — Feature Toggle
    const pontoAtivo = await verificarFeatureToggle(supabaseAdmin, "ponto_eletronico_ativo");
    if (!pontoAtivo) {
      console.log(`[registrar-ponto-totem] Toggle OFF | dispositivo=${payload.codigo_dispositivo}`);
      return respostaErro(503, "toggle_desativado", "Módulo de ponto eletrônico ainda não está ativo");
    }

    // PASSO 5 — Validar dispositivo
    const deviceSecret = req.headers.get("x-device-secret");
    const dispResult = await validarDispositivoTotem(supabaseAdmin, payload.codigo_dispositivo, deviceSecret);
    if (!dispResult.valido) {
      return respostaErro(dispResult.status!, "dispositivo_invalido", dispResult.erro || "Dispositivo inválido");
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
      return respostaErro(404, "funcionario_nao_encontrado", "Funcionário não encontrado");
    }

    if (!["Ativo", "Ativo sem Registro"].includes(func.status)) {
      return respostaErro(403, "funcionario_inativo", "Funcionário inativo");
    }

    const funcionarioId = func.id;
    const ccIdTotem = dispositivo.centro_custo_id;

    // PASSO 7 — Deduplicação offline
    const batidaExistente = await verificarDeduplicacao(supabaseAdmin, payload.offline_uuid);
    if (batidaExistente) {
      return new Response(
        JSON.stringify({ success: true, duplicado: true, batida_id: batidaExistente }),
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
      console.log("[PONTO][BLOQUEIO]", {
        funcionarioId, motivo: "sem_vinculo_obra", ccId: ccIdTotem,
        latitude: dispositivo.latitude_fixa, longitude: dispositivo.longitude_fixa,
      });
      return respostaErro(403, "funcionario_sem_vinculo_obra", "Funcionário sem vínculo com esta obra");
    }

    // PASSO 9 — Config do CC
    const config = await carregarConfigCC(supabaseAdmin, ccIdTotem);

    // PASSO 10 — Divergência de relógio
    const { dataHoraConsiderada, flagDivergencia } = verificarDivergenciaRelogio(payload.data_hora_dispositivo);
    const dataOperacional = calcularDataOperacional(dataHoraConsiderada);

    // PASSO 10.5 — Tipo de dia + turno noturno
    const tipoRegistro = await verificarTipoDia(supabaseAdmin, dataOperacional, ccIdTotem);
    const turnoNoturno = await verificarTurnoNoturno(supabaseAdmin, funcionarioId, ccIdTotem);

    // PASSO 11 — Sequência
    const seq = await validarSequenciaBatidas(supabaseAdmin, funcionarioId, dataOperacional, payload.tipo_batida);
    if (!seq.valido) {
      return respostaErro(422, "sequencia_invalida", seq.erro || "Sequência de batidas inválida", { batidas_dia: seq.batidasDia });
    }

    // PASSO 12 — Duplicata temporal
    const isDup = await verificarDuplicataTemporal(supabaseAdmin, funcionarioId, payload.tipo_batida, dataHoraConsiderada);
    if (isDup) {
      return respostaErro(429, "duplicata_temporal", "Batida duplicada. Aguarde 5 minutos.");
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

    // PASSO 13 — Horário suspeito (respeitando turno noturno)
    if (verificarHorarioSuspeito(dataHoraConsiderada, turnoNoturno)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Horário suspeito (00-04h)");
      alertas.push({ tipo: "horario_suspeito", mensagem: "Registro entre 00:00 e 04:00" });
    }

    // Velocidade impossível
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

    // PASSO 13.5 — Intervalo ausente na saída
    if (verificarIntervaloAusente(payload.tipo_batida, seq.batidasDia, config.intervalo_obrigatorio)) {
      statusValidacao = "pendente_revisao";
      justificativas.push("Saída sem intervalo registrado");
      alertas.push({ tipo: "sem_intervalo", mensagem: "Saída sem intervalo" });
    }

    // PASSO 14 — Foto (obrigatória)
    if (!payload.foto_base64) {
      return respostaErro(403, "foto_obrigatoria", "Foto obrigatória para registro de ponto");
    }

    let fotoUrl: string | null = null;
    fotoUrl = await uploadFotoPonto(supabaseAdmin, funcionarioId, dataOperacional, payload.foto_base64);
    if (!fotoUrl) {
      return respostaErro(403, "foto_upload_falha", "Falha no upload da foto de evidência");
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
      return respostaErro(500, "erro_inserir_batida", "Erro ao registrar batida");
    }

    // PASSO 16 — Auditoria
    await registrarAuditoria(supabaseAdmin, "bd_ponto_batidas", batida.id, "INSERT", batidaRow, null, ip);

    // PASSO 16.5 — Integração apontamento (entrada)
    if (payload.tipo_batida === "entrada") {
      await integrarApontamentoEquipe(
        supabaseAdmin, funcionarioId, ccIdTotem, dataOperacional, batida.id, dataHoraConsiderada
      );
    }

    // PASSO 16.6 — Integração diárias (presença_diaria + entrada)
    if (tipoRegistro === "presenca_diaria" && payload.tipo_batida === "entrada") {
      await integrarDiariaPresenca(
        supabaseAdmin, funcionarioId, ccIdTotem, dataOperacional, batida.id, dataHoraConsiderada
      );
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
        dentro_raio: true,
        distancia_centro_metros: 0,
        status_validacao: statusValidacao,
        tipo_registro: tipoRegistro,
        score_risco: scoreRisco,
        alertas,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[registrar-ponto-totem] Erro geral:", e?.message || e);
    return respostaErro(500, "erro_interno", "Erro interno do servidor");
  }
});
