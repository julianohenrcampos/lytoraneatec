/**
 * Helper único de cálculo financeiro de diária (Fase 2.3 — P1).
 *
 * ESPELHO 1:1 da função SQL `public.fn_calcular_diaria_aplicada`
 * criada na Fase 2.2 (assinatura confirmada):
 *
 *   fn_calcular_diaria_aplicada(
 *     p_hora_entrada time,
 *     p_hora_saida   time,
 *     p_valor_base   numeric
 *   ) RETURNS TABLE(
 *     tipo_diaria              text,
 *     valor_diaria_aplicada    numeric,
 *     horas_liquidas           numeric,
 *     excede_12h               boolean
 *   )
 *
 * Regras (idênticas ao SQL):
 *  - entrada/saida null OU valor_base <= 0  → { tipo: null, valor: 0, horas_liq: 0, excede12h: false }
 *  - minutos = (hSaida*60 + mSaida) - (hEntrada*60 + mEntrada); se < 0, +24h (turno noturno)
 *  - horas_brutas = minutos / 60
 *  - horas_liq    = horas_brutas > 6 ? horas_brutas - 1 : horas_brutas   (desconto 1h almoço)
 *  - horas_brutas > 12               → 'uma_e_meia' x1.5 + excede_12h=true
 *  - horas_liq   >= 9.75             → 'uma_e_meia' x1.5
 *  - horas_liq   >= 4.5              → 'completa'   x1.0
 *  - horas_liq   >  0                → 'meia'       x0.5
 *  - caso contrário                  → 'nenhuma'    x0
 *  - valor_aplicado = round(valor_base * mult, 2)   (mesma semântica do ROUND SQL)
 *
 * ESTE ARQUIVO É PURO:
 *  - sem React, sem Supabase, sem imports de '@/'
 *  - pode ser espelhado byte-a-byte para `supabase/functions/_shared/calculoDiaria.ts`
 *
 * Fase 2.3 — P1: arquivo novo. NENHUM call site é alterado.
 */

export type TipoDiariaCalc = 'uma_e_meia' | 'completa' | 'meia' | 'nenhuma' | null;

export interface CalculoDiariaInput {
  hora_entrada: string | null | undefined; // 'HH:MM' ou 'HH:MM:SS'
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

/**
 * round(x, 2) com semântica equivalente ao ROUND(numeric, 2) do PostgreSQL
 * para os valores produzidos aqui (base * multiplicador finito).
 * Usa half-away-from-zero, que coincide com o ROUND numeric do PG quando o
 * valor é exato em decimal (caso típico: base com 2 casas × 0.5/1/1.5).
 */
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

/**
 * Espelho 1:1 de fn_calcular_diaria_aplicada(entrada, saida, base).
 * NÃO aplica regra de FDS/feriado nem de refeição — essas pertencem a
 * `fn_resolver_base_diaria` (lado backend, fora do escopo P1/P2).
 */
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
