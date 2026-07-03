/**
 * Extrai apenas o nome do logradouro (rua/estrada/avenida/rodovia) a partir
 * de um resultado de reverse geocoding do geocode-proxy.
 *
 * Regras:
 * - Preferir `endereco_rua` quando presente.
 * - Fallback: pegar o primeiro segmento de `place_name` antes da primeira vírgula.
 * - Nunca retornar cidade, CEP, estado ou país.
 * - Retorna string vazia se nada for identificável.
 */
export interface ReverseLike {
  endereco_rua?: string | null;
  place_name?: string | null;
}

// Remove numeração final tipo "123", "s/n", "km 12" solto no fim
function limparCauda(s: string): string {
  return s
    .replace(/\s*[-,]\s*(s\/n|sn|s\.n\.)\s*$/i, "")
    .replace(/\s*,?\s*\d{3,}\s*$/g, "") // CEPs/numerais soltos no fim
    .trim();
}

export function extrairLogradouro(reverse: ReverseLike | null | undefined): string {
  if (!reverse) return "";
  const rua = (reverse.endereco_rua || "").trim();
  if (rua) return limparCauda(rua);

  const pn = (reverse.place_name || "").trim();
  if (!pn) return "";
  const primeiro = pn.split(",")[0]?.trim() || "";
  return limparCauda(primeiro);
}
