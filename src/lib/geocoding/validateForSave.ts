// Bloqueia o submit quando o endereço não está pronto para gravação.
// Espelha o que a trigger fn_validar_geocoding_no_save faz no banco.

export type GeocodingStatus = "auto" | "manual" | "aproximado" | "erro" | "pending" | null | undefined;

export interface AddressForSave {
  latitude?: number | null;
  longitude?: number | null;
  geocoding_status?: GeocodingStatus;
  endereco_completo?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  reason?:
    | "sem_endereco"
    | "sem_coordenadas"
    | "coordenadas_parciais"
    | "geocoding_erro"
    | "requer_confirmacao_manual";
  action?: "abrir_mapa" | "preencher_endereco";
  message?: string;
}

export function validateAddressForSave(r: AddressForSave): ValidationResult {
  // Endereço opcional vazio → libera (ex.: empresa sem endereço cadastrado)
  if (!r?.endereco_completo || r.endereco_completo.trim().length === 0) {
    if (r?.latitude == null && r?.longitude == null) return { ok: true };
  }

  // Coordenadas parciais
  if ((r?.latitude == null) !== (r?.longitude == null)) {
    return {
      ok: false,
      reason: "coordenadas_parciais",
      action: "abrir_mapa",
      message: "Latitude e longitude devem estar preenchidas juntas.",
    };
  }

  // Endereço preenchido mas sem coords
  if (r?.endereco_completo && (r?.latitude == null || r?.longitude == null)) {
    return {
      ok: false,
      reason: "sem_coordenadas",
      action: "abrir_mapa",
      message: "Selecione um endereço da lista ou ajuste no mapa para gerar coordenadas.",
    };
  }

  if (r?.geocoding_status === "erro") {
    return {
      ok: false,
      reason: "geocoding_erro",
      action: "abrir_mapa",
      message: "Endereço com erro de geocoding. Ajuste no mapa antes de salvar.",
    };
  }

  if (r?.geocoding_status === "aproximado") {
    return {
      ok: false,
      reason: "requer_confirmacao_manual",
      action: "abrir_mapa",
      message: "Endereço aproximado. Confirme a posição no mapa antes de salvar.",
    };
  }

  return { ok: true };
}
