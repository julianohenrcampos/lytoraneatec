import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
};

// ========================
// Permissão explícita
// ========================
export async function validarPermissao(
  supabaseAdmin: SupabaseClient,
  authUserId: string,
  codigoPermissao: string
): Promise<boolean> {
  // Primeiro verifica SuperAdmin
  const { data: roles } = await supabaseAdmin
    .from("bd_user_roles")
    .select("role_id, bd_roles!inner(nome)")
    .eq("user_id", authUserId);

  if (roles?.some((r: any) => r.bd_roles?.nome === "SuperAdm")) {
    return true;
  }

  // Verifica permissão específica via role_permissions
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

  // Verifica override de usuário
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
  // Converte para fuso de São Paulo e extrai a data
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
  if (ccIdInformado) return ccIdInformado;

  // Buscar vínculo operacional ativo
  const hoje = new Date().toISOString().split("T")[0];
  const { data: vinculo } = await supabaseAdmin
    .from("bd_ponto_vinculos_operacionais")
    .select("centro_custo_id")
    .eq("funcionario_id", funcionarioId)
    .eq("ativo", true)
    .lte("data_inicio", hoje)
    .or(`data_fim.is.null,data_fim.gte.${hoje}`)
    .order("tipo_vinculo", { ascending: true }) // 'fixo' vem primeiro
    .order("data_inicio", { ascending: false })
    .limit(1);

  if (vinculo && vinculo.length > 0) {
    return vinculo[0].centro_custo_id;
  }

  // Fallback: bd_funcionarios.centro_custo_id
  const { data: func } = await supabaseAdmin
    .from("bd_funcionarios")
    .select("centro_custo_id")
    .eq("id", funcionarioId)
    .single();

  return func?.centro_custo_id || null;
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
  };
}

// ========================
// Validar sequência de batidas
// ========================
const SEQUENCIA_VALIDA: Record<string, string[]> = {
  entrada: [], // nenhuma batida antes no dia
  intervalo_inicio: ["entrada"],
  intervalo_fim: ["entrada", "intervalo_inicio"],
  saida: ["entrada"], // pode ter intervalo ou não
};

export async function validarSequenciaBatidas(
  supabaseAdmin: SupabaseClient,
  funcionarioId: string,
  dataOperacional: string,
  tipoBatida: string,
  batidasJaInseridas: string[] = []
): Promise<{ valido: boolean; erro?: string; batidasDia: string[] }> {
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

  // Verificar duplicata de tipo
  if (tipoBatida === "entrada" && batidasDia.includes("entrada")) {
    return { valido: false, erro: "Já existe entrada registrada para este dia", batidasDia };
  }
  if (tipoBatida === "saida" && batidasDia.includes("saida")) {
    return { valido: false, erro: "Já existe saída registrada para este dia", batidasDia };
  }

  // Verificar pré-requisitos
  if (tipoBatida === "intervalo_inicio") {
    if (!batidasDia.includes("entrada")) {
      return { valido: false, erro: "Necessário registrar entrada antes do intervalo", batidasDia };
    }
    // Não pode ter intervalo_inicio pendente (sem intervalo_fim)
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
    // Se tem intervalo_inicio sem intervalo_fim, bloqueia
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

  if (deltaHoras < 0.01) return distKm > 2; // < 36s e > 2km
  const velocidade = distKm / deltaHoras;
  return velocidade > 120 && deltaHoras < 0.5;
}

// ========================
// Horário suspeito (00-04h BRT)
// ========================
export function verificarHorarioSuspeito(dataHora: string): boolean {
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
    // Remover prefix data:image/...;base64,
    const base64Data = fotoBase64.includes(",")
      ? fotoBase64.split(",")[1]
      : fotoBase64;

    // Validar tamanho (max 2MB decodificado)
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

  if (!dispositivo) {
    return { valido: false, erro: "Dispositivo não cadastrado", status: 404 };
  }

  if (!dispositivo.ativo) {
    return { valido: false, erro: "Dispositivo desativado", status: 403 };
  }

  // Validar segredo do dispositivo (se configurado)
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
