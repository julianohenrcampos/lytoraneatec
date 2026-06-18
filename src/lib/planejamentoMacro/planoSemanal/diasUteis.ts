// Fase 6J.1 — Dias úteis (segunda a sexta). Feriados serão tratados em 6J.2.

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ehDiaUtil(date: Date): boolean {
  const dow = date.getDay();
  return dow >= 1 && dow <= 5;
}

/** Lista os dias úteis ISO entre `inicio` e `fim` inclusivos. Retorna [] se inicio > fim. */
export function listarDiasUteis(inicioISO: string, fimISO: string): string[] {
  if (inicioISO > fimISO) return [];
  const inicio = parseISO(inicioISO);
  const fim = parseISO(fimISO);
  const out: string[] = [];
  const cur = new Date(inicio);
  while (cur.getTime() <= fim.getTime()) {
    if (ehDiaUtil(cur)) out.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function contarDiasUteis(inicioISO: string, fimISO: string): number {
  return listarDiasUteis(inicioISO, fimISO).length;
}

/** Interseção [maxInicio, minFim] entre dois intervalos. Retorna null se vazio. */
export function intersecao(
  aInicio: string,
  aFim: string,
  bInicio: string,
  bFim: string
): { inicio: string; fim: string } | null {
  const inicio = aInicio > bInicio ? aInicio : bInicio;
  const fim = aFim < bFim ? aFim : bFim;
  if (inicio > fim) return null;
  return { inicio, fim };
}
