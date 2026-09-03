/**
 * Formatadores de data para exibição em pt-BR (dd/mm/aaaa).
 *
 * IMPORTANTE:
 * - Não usa `new Date("YYYY-MM-DD")` diretamente (evita off-by-one por timezone).
 * - Não altera payloads enviados ao banco: apenas UI muda.
 * - Zero dependências novas.
 */

export function formatDateBR(value?: string | Date | null, fallback = "—"): string {
  if (value == null || value === "") return fallback;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return fallback;
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const y = String(value.getFullYear());
    return `${d}/${m}/${y}`;
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  return fallback;
}

export function formatDateTimeBR(value?: string | Date | null, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
