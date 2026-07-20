import { normalizarTextoLogradouro } from "./normalizarTextoLogradouro";

/**
 * Formata a exibição do logradouro combinando nome vindo do mapa e nome
 * atual/local (declarado manualmente).
 *
 * Regras:
 * - ambos vazios -> "Sem logradouro"
 * - apenas mapa -> mapa
 * - apenas local -> local
 * - equivalentes após normalização -> apenas mapa (evita duplicidade)
 * - diferentes -> "{mapa} / {local}"
 */
export function formatarLogradouroExibicao(
  mapa: string | null | undefined,
  local: string | null | undefined,
): string {
  const m = (mapa ?? "").trim();
  const l = (local ?? "").trim();
  if (!m && !l) return "Sem logradouro";
  if (m && !l) return m;
  if (!m && l) return l;
  if (normalizarTextoLogradouro(m) === normalizarTextoLogradouro(l)) return m;
  return `${m} / ${l}`;
}
