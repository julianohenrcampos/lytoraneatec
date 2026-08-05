// Fase 7A — Normaliza datas/horas do MS Project para YYYY-MM-DD sem deslocamento por fuso.
// Nunca usa new Date(x).toISOString() para campos `date`.

/**
 * Aceita formatos do MS Project como:
 *   "2026-06-16T08:00:00"
 *   "2026-06-16T23:59:00"
 *   "2026-06-16"
 *   "2026-06-16T00:00:00Z"
 * Sempre retorna "YYYY-MM-DD" ou null. Não retrocede o dia por timezone.
 */
export function normalizarDataMsProject(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2999 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Converte uma duração ISO 8601 (PT#H#M#S) para horas decimais.
 * Aceita também "0" ou vazio → 0.
 */
export function durationIsoParaHoras(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;
  // formato PT#H#M#S — todos opcionais
  const m = s.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!m) {
    // fallback: número puro = horas
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const h = Number(m[1] ?? 0);
  const mi = Number(m[2] ?? 0);
  const se = Number(m[3] ?? 0);
  return h + mi / 60 + se / 3600;
}
