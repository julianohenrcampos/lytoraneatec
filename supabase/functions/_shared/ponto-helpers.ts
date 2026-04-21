import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ========================
// Haversine
// ========================
export function haversineMetros(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ========================
// CORS Headers
// ========================
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-device-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ========================
// Tipos auxiliares
// ========================
export interface ConfigCC {
  raio_metros: number;
  tolerancia_minutos: number;
  jornada_inicio: string;
  jornada_fim: string;
  exige_foto: boolean;
  exige_gps: boolean;
  permite_ponto_fora_raio: boolean;
  permite_banco_horas: boolean;
  intervalo_obrigatorio: boolean;
  intervalo_minutos: number;
  modo_geofence: "restritivo" | "flexivel";
  permite_offline_pwa: boolean;
  // CLT / antifraude
  tempo_min_entre_batidas_min: number;
  tempo_min_para_intervalo_min: number;
  jornada_para_intervalo_min: number;
  intervalo_padrao_min: number;
  intervalo_padrao_inicio: string; // "HH:MM"
}

export interface ResultadoDivergencia {
  dataHoraConsiderada: string;
  flagDivergencia: boolean;
}

export interface ResultadoGeofence {
  dentroRaio: boolean;
  distanciaMetros: number;
}

export interface AlertaPonto {
  tipo: string;
  mensagem: string;
}

export interface ScoreRiscoFlags {
  foraRaio: boolean;
  semFoto: boolean;
  gpsImpreciso: boolean;
  divergenciaRelogio: boolean;
  offline: boolean;
  dispositivoDiferente?: boolean;
}

const CONFIG_DEFAULTS: ConfigCC = {
  raio_metros: 200,
  tolerancia_minutos: 10,
  jornada_inicio: "07:00",
  jornada_fim: "17:00",
  exige_foto: true,
  exige_gps: true,
  permite_ponto_fora_raio: false,
  permite_banco_horas: false,
  intervalo_obrigatorio: true,
  intervalo_minutos: 60,
  modo_geofence: "flexivel",
  permite_offline_pwa: false,
  tempo_min_entre_batidas_min: 10,
  tempo_min_para_intervalo_min: 240,
  jornada_para_intervalo_min: 360,
  intervalo_padrao_min: 60,
  intervalo_padrao_inicio: "12:00",
};

// ========================
// Permissão explícita
// ========================
export async function validarPermissao(
  supabaseAdmin: SupabaseClient,
  authUserId: string,
  codigoPermissao: string
): Promise<boolean> {
  const { data: roles } = await supabaseAdmin
    .from("bd_user_roles")
    .select("role_id, bd_roles!inner(nome)")
    .eq("user_id", authUserId);

  if (roles?.some((r: any) => r.bd_roles?.nome === "SuperAdm")) {
    return true;
  }

  const roleIds = roles?.map((r: any) => r.role_id) || [];
  if (roleIds.length === 0) return false;

  const { data: perms } = await supabaseAdmin
    .from("bd_role_permissions")
    .select("id")
    .in("role_id", roleIds)
    .eq("codigo_permissao", codigoPermissao)
    .eq("permitido", true)
    .limit(1);

  if (perms && perms.length > 0) return true;

  const { data: overrides } = await supabaseAdmin
    .from("bd_user_permission_overrides")
    .select("permitido")
    .eq("user_id", authUserId)
    .eq("codigo_permissao", codigoPermissao)
    .limit(1);

  if (overrides && overrides.length > 0) {
    return overrides[0].permitido === true;
  }

  return false;
}

// ========================
// Data operacional (TZ São Paulo)
// ========================
export function calcularDataOperacional(dataHoraConsiderada: string): string {
  const dt = new Date(dataHoraConsiderada);
  const spFormatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return spFormatter.format(dt); // YYYY-MM-DD
}

// ========================
// Divergência de relógio
// ========================
export function verificarDivergenciaRelogio(
  dataHoraDispositivo: string
): ResultadoDivergencia {
  const agora = new Date();
  const dispositivo = new Date(dataHoraDispositivo);
  const deltaMs = Math.abs(agora.getTime() - dispositivo.getTime());
  const deltaMinutos = deltaMs / 60000;

  if (deltaMinutos > 5) {
    return {
      dataHoraConsiderada: agora.toISOString(),
      flagDivergencia: true,
    };
  }

  return {
    dataHoraConsiderada: dataHoraDispositivo,
    flagDivergencia: false,
  };
}

// ========================
// Resolver centro de custo
// ========================
export async function resolverCentroCusto(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  ccIdInformado?: string | null
): Promise<string | null> {
  void funcionarioId;

  const ccIdCandidate =
    typeof ccIdInformado === "string" && ccIdInformado.trim() !== ""
      ? ccIdInformado.trim()
      : null;

  // Validação final: CC deve existir no banco
  if (!ccIdCandidate || typeof ccIdCandidate !== "string" || ccIdCandidate.trim() === "") {
    return null;
  }

  const { data: cc } = await supabaseAdmin
    .from("bd_centros_custo")
    .select("id")
    .eq("id", ccIdCandidate)
    .single();

  return cc ? ccIdCandidate : null;
}

// ========================
// Validar vínculo com CC
// ========================
export async function validarVinculoCC(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  ccId: string
): Promise<boolean> {
  // 1. Vínculo operacional ativo
  const { data: vinculo } = await supabaseAdmin
    .from("bd_ponto_vinculos_operacionais")
    .select("id")
    .eq("funcionario_id", funcionarioId)
    .eq("centro_custo_id", ccId)
    .eq("ativo", true)
    .limit(1);
  if (vinculo && vinculo.length > 0) return true;

  // 2. CC do cadastro do funcionário
  const { data: func } = await supabaseAdmin
    .from("bd_funcionarios")
    .select("centro_custo_id")
    .eq("id", funcionarioId)
    .single();
  if (func?.centro_custo_id === ccId) return true;

  // 3. Diária ativa (presença em solicitação aprovada/enviada)
  const { data: diaria } = await supabaseAdmin
    .from("bd_diaria_presencas")
    .select("id, solicitacao_id!inner(centro_custo_id, status)")
    .eq("funcionario_id", funcionarioId)
    .eq("solicitacao_id.centro_custo_id", ccId)
    .in("solicitacao_id.status", ["aprovada", "enviada"])
    .limit(1);
  if (diaria && diaria.length > 0) return true;

  return false;
}

// ========================
// Carregar configuração do CC
// ========================
export async function carregarConfigCC(
  supabaseAdmin: SupabaseClient,
  ccId: string
): Promise<ConfigCC> {
  const { data } = await supabaseAdmin
    .from("bd_ponto_config")
    .select("*")
    .eq("centro_custo_id", ccId)
    .limit(1)
    .single();

  if (!data) return { ...CONFIG_DEFAULTS };

  // intervalo_padrao_inicio pode vir como "HH:MM:SS"; normalizamos
  const inicioRaw = (data as any).intervalo_padrao_inicio ?? CONFIG_DEFAULTS.intervalo_padrao_inicio;
  const inicioNorm = typeof inicioRaw === "string" ? inicioRaw.slice(0, 5) : CONFIG_DEFAULTS.intervalo_padrao_inicio;

  return {
    raio_metros: data.raio_metros ?? CONFIG_DEFAULTS.raio_metros,
    tolerancia_minutos: data.tolerancia_minutos ?? CONFIG_DEFAULTS.tolerancia_minutos,
    jornada_inicio: data.jornada_inicio ?? CONFIG_DEFAULTS.jornada_inicio,
    jornada_fim: data.jornada_fim ?? CONFIG_DEFAULTS.jornada_fim,
    exige_foto: data.exige_foto ?? CONFIG_DEFAULTS.exige_foto,
    exige_gps: data.exige_gps ?? CONFIG_DEFAULTS.exige_gps,
    permite_ponto_fora_raio: data.permite_ponto_fora_raio ?? CONFIG_DEFAULTS.permite_ponto_fora_raio,
    permite_banco_horas: data.permite_banco_horas ?? CONFIG_DEFAULTS.permite_banco_horas,
    intervalo_obrigatorio: data.intervalo_obrigatorio ?? CONFIG_DEFAULTS.intervalo_obrigatorio,
    intervalo_minutos: data.intervalo_minutos ?? CONFIG_DEFAULTS.intervalo_minutos,
    modo_geofence: data.modo_geofence ?? CONFIG_DEFAULTS.modo_geofence,
    permite_offline_pwa: data.permite_offline_pwa ?? CONFIG_DEFAULTS.permite_offline_pwa,
    tempo_min_entre_batidas_min:
      (data as any).tempo_min_entre_batidas_min ?? CONFIG_DEFAULTS.tempo_min_entre_batidas_min,
    tempo_min_para_intervalo_min:
      (data as any).tempo_min_para_intervalo_min ?? CONFIG_DEFAULTS.tempo_min_para_intervalo_min,
    jornada_para_intervalo_min:
      (data as any).jornada_para_intervalo_min ?? CONFIG_DEFAULTS.jornada_para_intervalo_min,
    intervalo_padrao_min:
      (data as any).intervalo_padrao_min ?? CONFIG_DEFAULTS.intervalo_padrao_min,
    intervalo_padrao_inicio: inicioNorm,
  };
}

// ========================
// CLT — Tempo mínimo entre batidas (qualquer tipo)
// ========================
export async function verificarTempoMinimoEntreBatidas(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  dataOperacional: string,
  dataHora: string,
  minutos: number
): Promise<{ ok: boolean; ultimaIso?: string; deltaMin?: number }> {
  if (!minutos || minutos <= 0) return { ok: true };
  const { data } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("data_hora_considerada")
    .eq("funcionario_id", funcionarioId)
    .eq("data_operacional", dataOperacional)
    .neq("status_validacao", "invalidada")
    .order("data_hora_considerada", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return { ok: true };
  const ultimaIso = data[0].data_hora_considerada as string;
  const delta = (new Date(dataHora).getTime() - new Date(ultimaIso).getTime()) / 60000;
  if (delta < minutos) {
    return { ok: false, ultimaIso, deltaMin: Math.round(delta) };
  }
  return { ok: true, ultimaIso, deltaMin: Math.round(delta) };
}

// ========================
// CLT — Mínimo trabalhado para iniciar intervalo
// ========================
export async function verificarMinimoParaIntervalo(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  dataOperacional: string,
  dataHora: string,
  minutosMinimo: number
): Promise<{ ok: boolean; minutosTrabalhados?: number }> {
  const { data } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("data_hora_considerada")
    .eq("funcionario_id", funcionarioId)
    .eq("data_operacional", dataOperacional)
    .eq("tipo_batida", "entrada")
    .neq("status_validacao", "invalidada")
    .order("data_hora_considerada", { ascending: true })
    .limit(1);

  if (!data || data.length === 0) {
    // sem entrada — outra validação cobre isso
    return { ok: true };
  }
  const entradaIso = data[0].data_hora_considerada as string;
  const minutos = (new Date(dataHora).getTime() - new Date(entradaIso).getTime()) / 60000;
  if (minutos < minutosMinimo) {
    return { ok: false, minutosTrabalhados: Math.round(minutos) };
  }
  return { ok: true, minutosTrabalhados: Math.round(minutos) };
}

// ========================
// CLT — Saída antecipada (informativo, não bloqueia)
// ========================
export async function verificarSaidaAntecipada(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  dataOperacional: string,
  dataHora: string,
  minutosMinimo: number
): Promise<{ antecipada: boolean; minutosTrabalhados?: number }> {
  const { data } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("data_hora_considerada")
    .eq("funcionario_id", funcionarioId)
    .eq("data_operacional", dataOperacional)
    .eq("tipo_batida", "entrada")
    .neq("status_validacao", "invalidada")
    .order("data_hora_considerada", { ascending: true })
    .limit(1);

  if (!data || data.length === 0) return { antecipada: false };
  const entradaIso = data[0].data_hora_considerada as string;
  const minutos = (new Date(dataHora).getTime() - new Date(entradaIso).getTime()) / 60000;
  return { antecipada: minutos < minutosMinimo, minutosTrabalhados: Math.round(minutos) };
}

// ========================
// CLT — Gerar intervalo automático (entrada->saida sem intervalo)
// Insere 2 batidas sintéticas (intervalo_inicio/intervalo_fim) ANTES da saída.
// ========================
export async function gerarIntervaloAutomatico(
  supabaseAdmin: SupabaseClient,
  params: {
    funcionarioId: string;
    centroCustoId: string;
    dispositivoId: string;
    dataOperacional: string;
    dataHoraSaida: string; // ISO
    intervaloInicioHHMM: string; // "12:00"
    intervaloMinutos: number; // 60
    tipoRegistro: "controle_jornada" | "presenca_diaria";
  }
): Promise<{ criadas: number; entradaIso?: string; iniIso?: string; fimIso?: string }> {
  const {
    funcionarioId,
    centroCustoId,
    dispositivoId,
    dataOperacional,
    dataHoraSaida,
    intervaloInicioHHMM,
    intervaloMinutos,
    tipoRegistro,
  } = params;

  // Verifica intervalo já existente
  const { data: batidasDia } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("tipo_batida, data_hora_considerada")
    .eq("funcionario_id", funcionarioId)
    .eq("data_operacional", dataOperacional)
    .neq("status_validacao", "invalidada")
    .order("data_hora_considerada", { ascending: true });

  const tipos = (batidasDia ?? []).map((b: any) => b.tipo_batida);
  if (tipos.includes("intervalo_inicio") || tipos.includes("intervalo_fim")) {
    return { criadas: 0 };
  }
  const entrada = (batidasDia ?? []).find((b: any) => b.tipo_batida === "entrada");
  if (!entrada) return { criadas: 0 };

  const entradaMs = new Date(entrada.data_hora_considerada).getTime();
  const saidaMs = new Date(dataHoraSaida).getTime();
  const duracaoIntervaloMs = intervaloMinutos * 60 * 1000;

  // Tenta usar horário padrão (12:00 do dia operacional, em horário de SP)
  // Construímos ISO assumindo o offset do servidor — isso é "best effort".
  // Como a comparação é apenas por janela [entrada, saida], se não couber, usamos o meio.
  const [hh, mm] = intervaloInicioHHMM.split(":").map((n) => parseInt(n, 10));
  // Cria timestamp baseado em America/Sao_Paulo (UTC-3 fixo aproximado).
  const padraoLocal = new Date(`${dataOperacional}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`);
  let inicioMs = padraoLocal.getTime();
  let fimMs = inicioMs + duracaoIntervaloMs;

  const cabe = inicioMs > entradaMs && fimMs < saidaMs;
  if (!cabe) {
    const meio = entradaMs + (saidaMs - entradaMs - duracaoIntervaloMs) / 2;
    inicioMs = meio;
    fimMs = meio + duracaoIntervaloMs;
  }

  const iniIso = new Date(inicioMs).toISOString();
  const fimIso = new Date(fimMs).toISOString();

  const baseRow = {
    funcionario_id: funcionarioId,
    centro_custo_id: centroCustoId,
    dispositivo_id: dispositivoId,
    modo_registro: "automatico",
    data_operacional: dataOperacional,
    latitude: null,
    longitude: null,
    precisao_gps_metros: null,
    dentro_raio: true,
    distancia_centro_metros: 0,
    foto_url: null,
    origem_dados: "online",
    status_validacao: "pendente_revisao",
    status_sync: "sincronizado",
    justificativa: "Intervalo automático CLT (gerado pelo sistema)",
    ip_address: null,
    user_agent: null,
    device_fingerprint: null,
    tipo_registro: tipoRegistro,
    score_risco: 0,
  };

  const inicioRow = {
    ...baseRow,
    tipo_batida: "intervalo_inicio",
    data_hora_dispositivo: iniIso,
    data_hora_servidor: new Date().toISOString(),
    data_hora_considerada: iniIso,
    offline_uuid: crypto.randomUUID(),
  };
  const fimRow = {
    ...baseRow,
    tipo_batida: "intervalo_fim",
    data_hora_dispositivo: fimIso,
    data_hora_servidor: new Date().toISOString(),
    data_hora_considerada: fimIso,
    offline_uuid: crypto.randomUUID(),
  };

  const { error: e1 } = await supabaseAdmin.from("bd_ponto_batidas").insert(inicioRow);
  if (e1) {
    console.error("[ponto-clt] Falha ao inserir intervalo_inicio automático:", e1.message);
    return { criadas: 0 };
  }
  const { error: e2 } = await supabaseAdmin.from("bd_ponto_batidas").insert(fimRow);
  if (e2) {
    console.error("[ponto-clt] Falha ao inserir intervalo_fim automático:", e2.message);
    return { criadas: 1, iniIso };
  }

  console.log("[ponto-clt][INTERVALO_AUTO]", { funcionarioId, iniIso, fimIso, intervaloMinutos });
  return { criadas: 2, entradaIso: entrada.data_hora_considerada, iniIso, fimIso };
}

// ========================
// Validar sequência de batidas
// ========================
export async function validarSequenciaBatidas(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  dataOperacional: string,
  tipoBatida: string,
  batidasJaInseridas: string[] = []
): Promise<{ valido: boolean; erro?: string; motivo?: string; batidasDia: string[] }> {
  const { data } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("tipo_batida")
    .eq("funcionario_id", funcionarioId)
    .eq("data_operacional", dataOperacional)
    .neq("status_validacao", "invalidada")
    .order("data_hora_considerada", { ascending: true });

  const batidasDia = [
    ...(data?.map((b: any) => b.tipo_batida as string) || []),
    ...batidasJaInseridas,
  ];

  const temEntrada = batidasDia.includes("entrada");
  const temSaida = batidasDia.includes("saida");

  if (tipoBatida === "entrada" && temEntrada && !temSaida) {
    return { valido: false, erro: "Já existe uma jornada em andamento para este funcionário", motivo: "jornada_ja_iniciada", batidasDia };
  }
  if (tipoBatida === "saida" && batidasDia.includes("saida")) {
    return { valido: false, erro: "Já existe saída registrada para este dia", batidasDia };
  }

  if (tipoBatida === "intervalo_inicio") {
    if (!batidasDia.includes("entrada")) {
      return { valido: false, erro: "Necessário registrar entrada antes do intervalo", batidasDia };
    }
    const qtdInicio = batidasDia.filter((b) => b === "intervalo_inicio").length;
    const qtdFim = batidasDia.filter((b) => b === "intervalo_fim").length;
    if (qtdInicio > qtdFim) {
      return { valido: false, erro: "Intervalo anterior não foi finalizado", batidasDia };
    }
  }

  if (tipoBatida === "intervalo_fim") {
    const qtdInicio = batidasDia.filter((b) => b === "intervalo_inicio").length;
    const qtdFim = batidasDia.filter((b) => b === "intervalo_fim").length;
    if (qtdInicio <= qtdFim) {
      return { valido: false, erro: "Nenhum intervalo aberto para finalizar", batidasDia };
    }
  }

  if (tipoBatida === "saida") {
    if (!batidasDia.includes("entrada")) {
      return { valido: false, erro: "Necessário registrar entrada antes da saída", batidasDia };
    }
    const qtdInicio = batidasDia.filter((b) => b === "intervalo_inicio").length;
    const qtdFim = batidasDia.filter((b) => b === "intervalo_fim").length;
    if (qtdInicio > qtdFim) {
      return { valido: false, erro: "Finalize o intervalo antes de registrar saída", batidasDia };
    }
  }

  return { valido: true, batidasDia };
}

// ========================
// Duplicata temporal (< 5 min)
// ========================
export async function verificarDuplicataTemporal(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  tipoBatida: string,
  dataHora: string
): Promise<boolean> {
  const dt = new Date(dataHora);
  const min5antes = new Date(dt.getTime() - 5 * 60 * 1000).toISOString();
  const min5depois = new Date(dt.getTime() + 5 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("id")
    .eq("funcionario_id", funcionarioId)
    .eq("tipo_batida", tipoBatida)
    .neq("status_validacao", "invalidada")
    .gte("data_hora_considerada", min5antes)
    .lte("data_hora_considerada", min5depois)
    .limit(1);

  return (data?.length || 0) > 0;
}

// ========================
// Geofence via Haversine (RPC)
// ========================
export async function calcularGeofence(
  supabaseAdmin: SupabaseClient,
  lat: number | null,
  lon: number | null,
  ccId: string
): Promise<ResultadoGeofence | null> {
  if (lat == null || lon == null) return null;

  const { data: cc } = await supabaseAdmin
    .from("bd_centros_custo")
    .select("latitude, longitude, raio_ponto_metros")
    .eq("id", ccId)
    .single();

  if (!cc?.latitude || !cc?.longitude) return null;

  const { data: distancia } = await supabaseAdmin.rpc(
    "fn_calcular_distancia_haversine",
    {
      lat1: lat,
      lon1: lon,
      lat2: cc.latitude,
      lon2: cc.longitude,
    }
  );

  const dist = distancia ?? 0;
  const raio = cc.raio_ponto_metros ?? 200;

  return {
    dentroRaio: dist <= raio,
    distanciaMetros: Math.round(dist),
  };
}

// ========================
// Velocidade impossível
// ========================
export async function verificarVelocidadeImpossivel(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  lat: number | null,
  lon: number | null,
  dataHora: string
): Promise<boolean> {
  if (lat == null || lon == null) return false;

  const { data: ultima } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("latitude, longitude, data_hora_considerada")
    .eq("funcionario_id", funcionarioId)
    .neq("status_validacao", "invalidada")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("data_hora_considerada", { ascending: false })
    .limit(1)
    .single();

  if (!ultima?.latitude || !ultima?.longitude) return false;

  const { data: distancia } = await supabaseAdmin.rpc(
    "fn_calcular_distancia_haversine",
    {
      lat1: ultima.latitude,
      lon1: ultima.longitude,
      lat2: lat,
      lon2: lon,
    }
  );

  const distKm = (distancia ?? 0) / 1000;
  const dtAtual = new Date(dataHora).getTime();
  const dtAnterior = new Date(ultima.data_hora_considerada).getTime();
  const deltaHoras = Math.abs(dtAtual - dtAnterior) / 3600000;

  if (deltaHoras < 0.01) return distKm > 2;
  const velocidade = distKm / deltaHoras;
  return velocidade > 120 && deltaHoras < 0.5;
}

// ========================
// Horário suspeito (00-04h BRT)
// ========================
export function verificarHorarioSuspeito(dataHora: string, turnoNoturno: boolean = false): boolean {
  if (turnoNoturno) return false;

  const dt = new Date(dataHora);
  const horaFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
  });
  const hora = parseInt(horaFormatter.format(dt), 10);
  return hora >= 0 && hora < 4;
}

// ========================
// Upload de foto
// ========================
export async function uploadFotoPonto(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  dataOperacional: string,
  fotoBase64: string
): Promise<string | null> {
  try {
    const base64Data = fotoBase64.includes(",")
      ? fotoBase64.split(",")[1]
      : fotoBase64;

    const estimatedSize = (base64Data.length * 3) / 4;
    if (estimatedSize > 2 * 1024 * 1024) {
      console.error("[ponto-foto] Foto excede 2MB");
      return null;
    }

    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const uuid = crypto.randomUUID();
    const path = `${funcionarioId}/${dataOperacional}/${uuid}.jpg`;

    const { error } = await supabaseAdmin.storage
      .from("ponto-fotos")
      .upload(path, bytes, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("[ponto-foto] Upload falhou:", error.message);
      return null;
    }

    return path;
  } catch (e) {
    console.error("[ponto-foto] Erro inesperado:", e);
    return null;
  }
}

// ========================
// Limpar foto órfã
// ========================
export async function limparFotoOrfa(
  supabaseAdmin: SupabaseClient,
  path: string
): Promise<void> {
  try {
    await supabaseAdmin.storage.from("ponto-fotos").remove([path]);
    console.log("[ponto-foto] Foto órfã removida:", path);
  } catch (e) {
    console.error("[ponto-foto] Falha ao remover foto órfã:", e);
  }
}

// ========================
// Auditoria (try/catch isolado)
// ========================
export async function registrarAuditoria(
  supabaseAdmin: SupabaseClient,
  tabela: string,
  registroId: string,
  acao: string,
  dadosNovos: Record<string, any>,
  usuarioId: string | null,
  ip: string | null
): Promise<void> {
  try {
    await supabaseAdmin.from("bd_ponto_audit_log").insert({
      tabela,
      registro_id: registroId,
      acao,
      dados_anteriores: null,
      dados_novos: dadosNovos,
      usuario_id: usuarioId,
      ip,
    });
  } catch (e) {
    console.error("[ponto-audit] Falha ao registrar auditoria:", e);
  }
}

// ========================
// Validar dispositivo totem (API key + device secret)
// ========================
export async function validarDispositivoTotem(
  supabaseAdmin: SupabaseClient,
  codigoDispositivo: string,
  deviceSecret: string | null
): Promise<{
  valido: boolean;
  erro?: string;
  status?: number;
  dispositivo?: any;
}> {
  const { data: dispositivo } = await supabaseAdmin
    .from("bd_ponto_dispositivos")
    .select("id, centro_custo_id, latitude_fixa, longitude_fixa, ativo, device_secret_hash")
    .eq("codigo_dispositivo", codigoDispositivo)
    .single();

  console.log("[PONTO][DEVICE_CHECK]", {
    codigo: codigoDispositivo,
    encontrado: !!dispositivo,
    ativo: dispositivo?.ativo,
    temHash: !!dispositivo?.device_secret_hash,
    temSecret: !!deviceSecret,
  });

  if (!dispositivo) {
    return { valido: false, erro: "Dispositivo não cadastrado", status: 404 };
  }

  if (!dispositivo.ativo) {
    return { valido: false, erro: "Dispositivo desativado", status: 403 };
  }

  if (dispositivo.device_secret_hash) {
    if (!deviceSecret) {
      return { valido: false, erro: "Segredo do dispositivo não fornecido", status: 401 };
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(deviceSecret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (hashHex !== dispositivo.device_secret_hash) {
      return { valido: false, erro: "Segredo do dispositivo inválido", status: 401 };
    }
  }

  return { valido: true, dispositivo };
}

// ========================
// Extrair IP do request
// ========================
export function extrairIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

// ========================
// Deduplicação offline_uuid
// ========================
export async function verificarDeduplicacao(
  supabaseAdmin: SupabaseClient,
  offlineUuid: string | null
): Promise<string | null> {
  if (!offlineUuid) return null;

  const { data } = await supabaseAdmin
    .from("bd_ponto_batidas")
    .select("id")
    .eq("offline_uuid", offlineUuid)
    .limit(1);

  return data && data.length > 0 ? data[0].id : null;
}

// ========================
// Feature Toggle — verificar configuração do sistema
// ========================
export async function verificarFeatureToggle(
  supabaseAdmin: SupabaseClient,
  chave: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("bd_configuracoes_sistema")
    .select("valor")
    .eq("chave", chave)
    .eq("ativo", true)
    .maybeSingle();

  return data?.valor === "true";
}

// ========================
// Modo teste — verificar permissão ponto_teste
// ========================
export async function verificarModoTeste(
  supabaseAdmin: SupabaseClient,
  userId: string | null
): Promise<boolean> {
  if (!userId) return false;

  // Usa o sistema RBAC existente (validarPermissao)
  return await validarPermissao(supabaseAdmin, userId, "ponto_teste");
}

// ========================
// FASE 3 — Score de risco
// ========================
export function calcularScoreRisco(flags: ScoreRiscoFlags): number {
  let score = 0;
  if (flags.foraRaio) score++;
  if (flags.semFoto) score++;
  if (flags.gpsImpreciso) score++;
  if (flags.divergenciaRelogio) score++;
  if (flags.offline) score++;
  if (flags.dispositivoDiferente) score++;
  return score;
}

// ========================
// FASE 3 — Verificar tipo de dia (feriado/fim de semana)
// ========================
export async function verificarTipoDia(
  supabaseAdmin: SupabaseClient,
  dataOperacional: string,
  ccId: string
): Promise<"controle_jornada" | "presenca_diaria"> {
  // Verificar dia da semana (0=dom, 6=sáb)
  // dataOperacional é YYYY-MM-DD, precisamos criar um Date correto
  const [ano, mes, dia] = dataOperacional.split("-").map(Number);
  const dt = new Date(ano, mes - 1, dia);
  const diaSemana = dt.getDay();

  if (diaSemana === 0 || diaSemana === 6) {
    return "presenca_diaria";
  }

  // Verificar feriados — buscar pelo data exata
  const { data: feriados } = await supabaseAdmin
    .from("bd_feriados")
    .select("id")
    .eq("data", dataOperacional)
    .limit(1);

  if (feriados && feriados.length > 0) {
    return "presenca_diaria";
  }

  return "controle_jornada";
}

// ========================
// FASE 3 — Verificar turno noturno
// ========================
export async function verificarTurnoNoturno(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  ccId: string
): Promise<boolean> {
  // Verifica horários padrão no config do CC
  const { data } = await supabaseAdmin
    .from("bd_ponto_config")
    .select("jornada_inicio, jornada_fim")
    .eq("centro_custo_id", ccId)
    .limit(1)
    .single();

  if (!data) return false;

  const inicio = data.jornada_inicio || "07:00";
  const fim = data.jornada_fim || "17:00";

  // Turno noturno: entrada >= 19:00 ou saída <= 07:00
  const horaInicio = parseInt(inicio.split(":")[0], 10);
  const horaFim = parseInt(fim.split(":")[0], 10);

  return horaInicio >= 19 || horaFim <= 7;
}

// ========================
// FASE 3 — Verificar intervalo ausente na saída
// ========================
export function verificarIntervaloAusente(
  tipoBatida: string,
  batidasDia: string[],
  intervaloObrigatorio: boolean
): boolean {
  if (tipoBatida !== "saida") return false;
  if (!intervaloObrigatorio) return false;

  const temIntervalo = batidasDia.includes("intervalo_inicio") && batidasDia.includes("intervalo_fim");
  return !temIntervalo;
}

// ========================
// FASE 3 — Integrar com apontamento de equipe
// ========================
export async function integrarApontamentoEquipe(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  ccId: string,
  dataOperacional: string,
  batidaId: string,
  horaEntrada: string
): Promise<void> {
  try {
    // Buscar equipe do funcionário via vínculo operacional ativo
    const hoje = new Date().toISOString().split("T")[0];
    const { data: vinculo } = await supabaseAdmin
      .from("bd_ponto_vinculos_operacionais")
      .select("equipe_id")
      .eq("funcionario_id", funcionarioId)
      .eq("ativo", true)
      .not("equipe_id", "is", null)
      .lte("data_inicio", hoje)
      .or(`data_fim.is.null,data_fim.gte.${hoje}`)
      .limit(1)
      .single();

    if (!vinculo?.equipe_id) {
      console.log(`[ponto-integracao] Sem equipe vinculada para func=${funcionarioId}, ignorando apontamento`);
      return;
    }

    const equipeId = vinculo.equipe_id;

    // Verificar duplicidade: colaborador_id + data_registro + equipe_id
    const { data: existente } = await supabaseAdmin
      .from("bd_apontamento_equipe")
      .select("id")
      .eq("colaborador_id", funcionarioId)
      .eq("data_registro", dataOperacional)
      .eq("equipe_id", equipeId)
      .limit(1);

    if (existente && existente.length > 0) {
      console.log(`[ponto-integracao] Apontamento já existe para func=${funcionarioId} data=${dataOperacional}`);
      return;
    }

    // Buscar nome do funcionário
    const { data: funcData } = await supabaseAdmin
      .from("bd_funcionarios")
      .select("nome_completo")
      .eq("id", funcionarioId)
      .single();

    // Extrair hora HH:MM da data_hora_considerada
    const horaFormatted = new Date(horaEntrada).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // INSERT em bd_apontamento_equipe
    const { data: apontamento, error: insertError } = await supabaseAdmin
      .from("bd_apontamento_equipe")
      .insert({
        equipe_id: equipeId,
        colaborador_id: funcionarioId,
        nome_colaborador: funcData?.nome_completo || "Desconhecido",
        data_registro: dataOperacional,
        presente: true,
        hora_inicio: horaFormatted,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[ponto-integracao] Erro ao inserir apontamento:", insertError.message);
      return;
    }

    // Registrar vínculo na tabela de integração
    await supabaseAdmin.from("bd_ponto_apontamento_integracao").insert({
      batida_id: batidaId,
      apontamento_id: apontamento.id,
    });

    console.log(`[ponto-integracao] Apontamento criado: func=${funcionarioId} equipe=${equipeId} data=${dataOperacional}`);
  } catch (e) {
    console.error("[ponto-integracao] Erro na integração com apontamento:", e);
  }
}

// ========================
// FASE 3 — Integrar com diárias (presença)
// ========================
export async function integrarDiariaPresenca(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  ccId: string,
  dataOperacional: string,
  batidaId: string,
  horaEntrada: string
): Promise<void> {
  try {
    // Buscar solicitação de diária ativa para este CC + data
    const { data: solicitacoes } = await supabaseAdmin
      .from("bd_diaria_solicitacoes")
      .select("id, convocados_pre, centro_custo_id")
      .eq("centro_custo_id", ccId)
      .in("status", ["aprovada", "em_andamento"])
      .lte("data_inicio", dataOperacional)
      .gte("data_fim", dataOperacional)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!solicitacoes || solicitacoes.length === 0) {
      console.log(`[ponto-diaria] Sem solicitação ativa para CC=${ccId} data=${dataOperacional}`);
      return;
    }

    // Encontrar solicitação onde o funcionário está no convocados_pre
    let solicitacaoAlvo: any = null;
    let convocadoData: any = null;

    for (const sol of solicitacoes) {
      const convocados = sol.convocados_pre as any[];
      if (!convocados || !Array.isArray(convocados)) continue;

      const found = convocados.find(
        (c: any) => c.funcionario_id === funcionarioId
      );
      if (found) {
        solicitacaoAlvo = sol;
        convocadoData = found;
        break;
      }
    }

    if (!solicitacaoAlvo || !convocadoData) {
      console.log(`[ponto-diaria] Funcionário ${funcionarioId} não está nos convocados de nenhuma solicitação ativa`);
      return;
    }

    // Verificar duplicidade: funcionario_id + data + solicitacao_id
    const { data: existente } = await supabaseAdmin
      .from("bd_diaria_presencas")
      .select("id")
      .eq("funcionario_id", funcionarioId)
      .eq("data", dataOperacional)
      .eq("solicitacao_id", solicitacaoAlvo.id)
      .limit(1);

    if (existente && existente.length > 0) {
      console.log(`[ponto-diaria] Presença já existe para func=${funcionarioId} data=${dataOperacional} sol=${solicitacaoAlvo.id}`);
      return;
    }

    // Extrair hora
    const horaFormatted = new Date(horaEntrada).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // INSERT em bd_diaria_presencas
    const { data: presenca, error: insertError } = await supabaseAdmin
      .from("bd_diaria_presencas")
      .insert({
        solicitacao_id: solicitacaoAlvo.id,
        funcionario_id: funcionarioId,
        data: dataOperacional,
        presente: true,
        hora_entrada: horaFormatted,
        valor_diaria_aplicada: convocadoData.valor_diaria || null,
        funcao_id: convocadoData.funcao_id || null,
        tipo_diaria: convocadoData.tipo_diaria || "completa",
        turno: convocadoData.turno || "diurno",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[ponto-diaria] Erro ao inserir presença:", insertError.message);
      return;
    }

    // Registrar vínculo na tabela de integração
    await supabaseAdmin.from("bd_ponto_diaria_integracao").insert({
      batida_id: batidaId,
      presenca_diaria_id: presenca.id,
      solicitacao_id: solicitacaoAlvo.id,
    });

    console.log(`[ponto-diaria] Presença criada: func=${funcionarioId} sol=${solicitacaoAlvo.id} data=${dataOperacional}`);
  } catch (e) {
    console.error("[ponto-diaria] Erro na integração com diárias:", e);
  }
}

// ========================
// Resposta de erro padronizada
// ========================
export function respostaErro(
  status: number,
  motivo: string,
  message: string,
  extrasOrStage?: Record<string, any> | string,
  extras?: Record<string, any>
): Response {
  let stage: string | undefined;
  let extrasFinal: Record<string, any> | undefined;
  if (typeof extrasOrStage === "string") {
    stage = extrasOrStage;
    extrasFinal = extras;
  } else {
    extrasFinal = extrasOrStage;
  }
  console.log("[PONTO][ERROR]", { status, motivo, message, stage });
  return new Response(
    JSON.stringify({
      success: false,
      status_validacao: "rejeitado",
      motivo,
      error: motivo,
      message,
      stage,
      ...extrasFinal,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
