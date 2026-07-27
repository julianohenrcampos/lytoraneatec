/**
 * Utilitários para campos DATE puros ("YYYY-MM-DD").
 *
 * PROBLEMA: `new Date("2026-07-27")` é interpretado pelo JS como meia-noite UTC.
 * Em UTC-3 (Brasil) isso vira 26/07 21:00 local — e ao reserializar com
 * `format(date, "yyyy-MM-dd")` grava o dia anterior (off-by-one).
 *
 * Use estas funções sempre que o valor for uma DATA PURA (sem hora).
 * Para timestamps (created_at, data_registro) continue usando `new Date()`.
 */

/** Converte "YYYY-MM-DD" em Date na meia-noite LOCAL (sem deslocamento de fuso). */
export function parseDateOnly(value?: string | Date | null): Date | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return isNaN(value.getTime()) ? undefined : value;

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? undefined : d;
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? undefined : fallback;
}

/** Serializa um Date para "YYYY-MM-DD" usando os componentes LOCAIS. */
export function toDateOnlyString(date?: Date | null): string | null {
  if (!date || isNaN(date.getTime())) return null;
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
