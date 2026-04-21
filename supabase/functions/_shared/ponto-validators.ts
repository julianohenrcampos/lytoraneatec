// Validação manual sem Zod (Deno edge runtime)

export interface PayloadRegistrarPonto {
  tipo_batida: string;
  data_hora_dispositivo: string;
  latitude: number | null;
  longitude: number | null;
  precisao_gps_metros: number | null;
  foto_base64: string | null;
  centro_custo_id: string | null;
  offline_uuid: string | null;
  device_fingerprint: string | null;
  user_agent: string | null;
}

export interface PayloadRegistrarPontoTotem {
  codigo_dispositivo: string;
  identificador_funcionario: string;
  tipo_identificador: "matricula" | "cpf";
  tipo_batida: string;
  data_hora_dispositivo: string;
  foto_base64: string | null;
  offline_uuid: string | null;
  latitude: number | null;
  longitude: number | null;
  precisao_gps_metros: number | null;
}

export interface PayloadBatidaOffline {
  offline_uuid: string;
  tipo_batida: string;
  data_hora_dispositivo: string;
  latitude: number | null;
  longitude: number | null;
  precisao_gps_metros: number | null;
  foto_base64: string | null;
  centro_custo_id: string | null;
  device_fingerprint: string | null;
  user_agent: string | null;
  tentativa_sync: number;
}

export interface PayloadSyncOffline {
  batidas: PayloadBatidaOffline[];
}

export interface PayloadHeartbeat {
  codigo_dispositivo: string;
  status: string;
  bateria: number | null;
  versao_app: string | null;
  timestamp_dispositivo: string | null;
}

const TIPOS_BATIDA_VALIDOS = ["entrada", "intervalo_inicio", "intervalo_fim", "saida"];

function isIsoDate(s: string): boolean {
  return !isNaN(Date.parse(s));
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function validarPayloadRegistrarPonto(body: any): { valido: boolean; erro?: string; dados?: PayloadRegistrarPonto } {
  if (!body || typeof body !== "object") {
    return { valido: false, erro: "Payload inválido" };
  }

  if (!TIPOS_BATIDA_VALIDOS.includes(body.tipo_batida)) {
    return { valido: false, erro: `tipo_batida inválido. Esperado: ${TIPOS_BATIDA_VALIDOS.join(", ")}` };
  }

  if (!body.data_hora_dispositivo || !isIsoDate(body.data_hora_dispositivo)) {
    return { valido: false, erro: "data_hora_dispositivo inválida (ISO 8601)" };
  }

  if (body.centro_custo_id && !isUuid(body.centro_custo_id)) {
    return { valido: false, erro: "centro_custo_id deve ser UUID válido" };
  }

  if (body.offline_uuid && !isUuid(body.offline_uuid)) {
    return { valido: false, erro: "offline_uuid deve ser UUID válido" };
  }

  return {
    valido: true,
    dados: {
      tipo_batida: body.tipo_batida,
      data_hora_dispositivo: body.data_hora_dispositivo,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      precisao_gps_metros: typeof body.precisao_gps_metros === "number" ? body.precisao_gps_metros : null,
      foto_base64: typeof body.foto_base64 === "string" ? body.foto_base64 : null,
      centro_custo_id: body.centro_custo_id || null,
      offline_uuid: body.offline_uuid || null,
      device_fingerprint: typeof body.device_fingerprint === "string" ? body.device_fingerprint : null,
      user_agent: typeof body.user_agent === "string" ? body.user_agent : null,
    },
  };
}

export function validarPayloadTotem(body: any): { valido: boolean; erro?: string; dados?: PayloadRegistrarPontoTotem } {
  if (!body || typeof body !== "object") {
    return { valido: false, erro: "Payload inválido" };
  }

  if (!body.codigo_dispositivo || typeof body.codigo_dispositivo !== "string") {
    return { valido: false, erro: "codigo_dispositivo obrigatório" };
  }

  if (!body.identificador_funcionario || typeof body.identificador_funcionario !== "string") {
    return { valido: false, erro: "identificador_funcionario obrigatório" };
  }

  if (!["matricula", "cpf"].includes(body.tipo_identificador)) {
    return { valido: false, erro: "tipo_identificador deve ser 'matricula' ou 'cpf'" };
  }

  if (!TIPOS_BATIDA_VALIDOS.includes(body.tipo_batida)) {
    return { valido: false, erro: `tipo_batida inválido. Esperado: ${TIPOS_BATIDA_VALIDOS.join(", ")}` };
  }

  if (!body.data_hora_dispositivo || !isIsoDate(body.data_hora_dispositivo)) {
    return { valido: false, erro: "data_hora_dispositivo inválida (ISO 8601)" };
  }

  return {
    valido: true,
    dados: {
      codigo_dispositivo: body.codigo_dispositivo,
      identificador_funcionario: body.identificador_funcionario,
      tipo_identificador: body.tipo_identificador,
      tipo_batida: body.tipo_batida,
      data_hora_dispositivo: body.data_hora_dispositivo,
      foto_base64: typeof body.foto_base64 === "string" ? body.foto_base64 : null,
      offline_uuid: body.offline_uuid && isUuid(body.offline_uuid) ? body.offline_uuid : null,
      latitude: typeof body.latitude === "number" && isFinite(body.latitude) ? body.latitude : null,
      longitude: typeof body.longitude === "number" && isFinite(body.longitude) ? body.longitude : null,
      precisao_gps_metros:
        typeof body.precisao_gps_metros === "number" && isFinite(body.precisao_gps_metros)
          ? body.precisao_gps_metros
          : null,
    },
  };
}

export function validarPayloadSyncOffline(body: any): { valido: boolean; erro?: string; dados?: PayloadSyncOffline } {
  if (!body || typeof body !== "object" || !Array.isArray(body.batidas)) {
    return { valido: false, erro: "Payload deve conter array 'batidas'" };
  }

  if (body.batidas.length === 0) {
    return { valido: false, erro: "Array 'batidas' não pode estar vazio" };
  }

  // Verificar limites dinâmicos
  const comFoto = body.batidas.filter((b: any) => b.foto_base64).length;
  const semFoto = body.batidas.length - comFoto;

  if (comFoto > 15) {
    return { valido: false, erro: "Máximo 15 batidas com foto por lote" };
  }

  if (body.batidas.length > 50) {
    return { valido: false, erro: "Máximo 50 batidas por lote" };
  }

  // Estimar tamanho total do payload
  const payloadStr = JSON.stringify(body);
  if (payloadStr.length > 5 * 1024 * 1024) {
    return { valido: false, erro: "Payload excede 5MB" };
  }

  const batidasValidadas: PayloadBatidaOffline[] = [];
  for (let i = 0; i < body.batidas.length; i++) {
    const b = body.batidas[i];

    if (!b.offline_uuid || !isUuid(b.offline_uuid)) {
      return { valido: false, erro: `batidas[${i}]: offline_uuid obrigatório e deve ser UUID` };
    }

    if (!TIPOS_BATIDA_VALIDOS.includes(b.tipo_batida)) {
      return { valido: false, erro: `batidas[${i}]: tipo_batida inválido` };
    }

    if (!b.data_hora_dispositivo || !isIsoDate(b.data_hora_dispositivo)) {
      return { valido: false, erro: `batidas[${i}]: data_hora_dispositivo inválida` };
    }

    batidasValidadas.push({
      offline_uuid: b.offline_uuid,
      tipo_batida: b.tipo_batida,
      data_hora_dispositivo: b.data_hora_dispositivo,
      latitude: typeof b.latitude === "number" ? b.latitude : null,
      longitude: typeof b.longitude === "number" ? b.longitude : null,
      precisao_gps_metros: typeof b.precisao_gps_metros === "number" ? b.precisao_gps_metros : null,
      foto_base64: typeof b.foto_base64 === "string" ? b.foto_base64 : null,
      centro_custo_id: b.centro_custo_id || null,
      device_fingerprint: typeof b.device_fingerprint === "string" ? b.device_fingerprint : null,
      user_agent: typeof b.user_agent === "string" ? b.user_agent : null,
      tentativa_sync: typeof b.tentativa_sync === "number" ? b.tentativa_sync : 1,
    });
  }

  return { valido: true, dados: { batidas: batidasValidadas } };
}

export function validarPayloadHeartbeat(body: any): { valido: boolean; erro?: string; dados?: PayloadHeartbeat } {
  if (!body || typeof body !== "object") {
    return { valido: false, erro: "Payload inválido" };
  }

  if (!body.codigo_dispositivo || typeof body.codigo_dispositivo !== "string") {
    return { valido: false, erro: "codigo_dispositivo obrigatório" };
  }

  const statusValidos = ["online", "baixa_bateria", "erro"];
  if (!statusValidos.includes(body.status)) {
    return { valido: false, erro: `status inválido. Esperado: ${statusValidos.join(", ")}` };
  }

  return {
    valido: true,
    dados: {
      codigo_dispositivo: body.codigo_dispositivo,
      status: body.status,
      bateria: typeof body.bateria === "number" ? body.bateria : null,
      versao_app: typeof body.versao_app === "string" ? body.versao_app : null,
      timestamp_dispositivo: body.timestamp_dispositivo || null,
    },
  };
}
