/**
 * Espelho Deno do helper de cálculo de diária (Fase 2.3 — P2).
 *
 * MIRROR BYTE-A-BYTE de `src/lib/diarias/calculoDiaria.ts`.
 *
 * Mantenha os dois arquivos sincronizados. Qualquer alteração em um deve
 * ser replicada no outro. O teste `__tests__/calculoDiariaMirror.test.ts`
 * compara as duas implementações com a MESMA matriz de entradas e falha
 * se houver qualquer divergência numérica/tipo.
 *
 * Restrições deste arquivo (P2):
 *  - sem React, sem browser APIs;
 *  - sem Supabase client;
 *  - sem imports de '@/' ou de qualquer caminho do frontend.
 *
 * Fase 2.3 — P2: arquivo novo. NENHUM call site é alterado.
 * `auto-finalizar-diarias` continua usando sua fórmula inline.
 */

export type TipoDiariaCalc = 'uma_e_meia' | 'completa' | 'meia' | 'nenhuma' | null;

export interface CalculoDiariaInput {
  hora_entrada: string | null | undefined;
  hora_saida: string | null | undefined;
  valor_base: number | null | undefined;
}

export interface CalculoDiariaOutput {
  tipo_diaria: TipoDiariaCalc;
  valor_diaria_aplicada: number;
  horas_liquidas: number;
  excede_12h: boolean;
}

function parseHHMM(value: string): { h: number; m: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Reproduz ROUND(numeric, 2) do PostgreSQL (half-away-from-zero em decimal exato).
  // toPrecision(15) elimina o ruído binário típico (ex.: 149.98499999999999 → 149.985)
  // antes do arredondamento, alinhando com a aritmética numeric do PG.
  const normalized = Number(n.toPrecision(15));
  const scaled = normalized * 100;
  const rounded = scaled >= 0 ? Math.round(scaled) : -Math.round(-scaled);
  return rounded / 100;
}

export function calcularDiariaAplicada(input: CalculoDiariaInput): CalculoDiariaOutput {
  const baseNum = Number(input.valor_base ?? 0);

  if (
    input.hora_entrada == null ||
    input.hora_saida == null ||
    !Number.isFinite(baseNum) ||
    baseNum <= 0
  ) {
    return {
      tipo_diaria: null,
      valor_diaria_aplicada: 0,
      horas_liquidas: 0,
      excede_12h: false,
    };
  }

  const e = parseHHMM(String(input.hora_entrada));
  const s = parseHHMM(String(input.hora_saida));
  if (!e || !s) {
    return {
      tipo_diaria: null,
      valor_diaria_aplicada: 0,
      horas_liquidas: 0,
      excede_12h: false,
    };
  }

  let min = (s.h * 60 + s.m) - (e.h * 60 + e.m);
  if (min < 0) min += 24 * 60;

  const horasBrutas = min / 60;
  const horasLiq = horasBrutas > 6 ? horasBrutas - 1 : horasBrutas;

  let tipo: TipoDiariaCalc;
  let mult: number;
  let excede12 = false;

  if (horasBrutas > 12) {
    tipo = 'uma_e_meia';
    mult = 1.5;
    excede12 = true;
  } else if (horasLiq >= 9.75) {
    tipo = 'uma_e_meia';
    mult = 1.5;
  } else if (horasLiq >= 4.5) {
    tipo = 'completa';
    mult = 1.0;
  } else if (horasLiq > 0) {
    tipo = 'meia';
    mult = 0.5;
  } else {
    tipo = 'nenhuma';
    mult = 0;
  }

  return {
    tipo_diaria: tipo,
    valor_diaria_aplicada: round2(baseNum * mult),
    horas_liquidas: horasLiq,
    excede_12h: excede12,
  };
}
