// Fase 6F — Normalização de datas para ISO date-only (YYYY-MM-DD).
// Evita qualquer deslocamento por timezone. Não usa new Date("YYYY-MM-DD") direto.

const pad2 = (n: number) => String(n).padStart(2, "0");

function ymdToIso(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (y < 1900 || y > 2999) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Aceita: 'DD/MM/AAAA', 'DD-MM-AAAA', 'YYYY-MM-DD', número serial Excel, Date.
 * Sempre retorna string ISO 'YYYY-MM-DD' ou null.
 * Nunca usa new Date("YYYY-MM-DD") direto para evitar UTC shift.
 */
export function normalizarDataIso(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Date object
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return ymdToIso(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  // Número (serial Excel)
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return serialExcelParaIso(raw);
  }

  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // YYYY-MM-DD (ou YYYY/MM/DD)
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return ymdToIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD/MM/AAAA ou DD-MM-AAAA
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return ymdToIso(y, Number(m[2]), Number(m[1]));
  }

  // String numérica → serial
  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 0) {
    return serialExcelParaIso(asNum);
  }

  return null;
}

/**
 * Converte um serial Excel para 'YYYY-MM-DD' sem passar por Date,
 * usando o mesmo algoritmo do XLSX.SSF.parse_date_code (epoch 1899-12-30).
 */
export function serialExcelParaIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;

  // Excel bug: 1900 é tratado como bissexto. Ajuste comum.
  let s = Math.floor(serial);
  if (s >= 60) s -= 1;

  // 1899-12-31 é o dia 0 após o ajuste.
  // Trabalhamos em UTC apenas para aritmética e extraímos Y/M/D em UTC.
  const baseUtcMs = Date.UTC(1899, 11, 31);
  const ms = baseUtcMs + s * 86400000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return ymdToIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
