/**
 * Fase 2.3 — P1: Testes de paridade do helper TS único de cálculo de diária
 * contra a função SQL `fn_calcular_diaria_aplicada` (Fase 2.2).
 *
 * Não há chamada de rede: os valores esperados foram derivados aplicando
 * MANUALMENTE a mesma regra do SQL e validados na Fase 2.2 (C1–C6).
 * Qualquer divergência aqui significa que o helper TS deriva da regra SQL.
 */

import { describe, it, expect } from 'vitest';
import {
  calcularDiariaAplicada,
  type CalculoDiariaInput,
  type CalculoDiariaOutput,
} from '@/lib/diarias/calculoDiaria';

interface Caso {
  nome: string;
  in: CalculoDiariaInput;
  esperado: CalculoDiariaOutput;
}

// Matriz alinhada com Fase 2.2 (C1–C6) + casos de borda.
const MATRIZ: Caso[] = [
  // ===== C1–C6 (Fase 2.2, já validados no banco) =====
  {
    nome: 'C1 — 07:00→16:00, base 100 → completa',
    in: { hora_entrada: '07:00', hora_saida: '16:00', valor_base: 100 },
    esperado: { tipo_diaria: 'completa', valor_diaria_aplicada: 100, horas_liquidas: 8, excede_12h: false },
  },
  {
    nome: 'C2 — 07:00→17:45, base 100 → uma_e_meia (liq=9.75)',
    in: { hora_entrada: '07:00', hora_saida: '17:45', valor_base: 100 },
    esperado: { tipo_diaria: 'uma_e_meia', valor_diaria_aplicada: 150, horas_liquidas: 9.75, excede_12h: false },
  },
  {
    nome: 'C3 — 07:00→11:00, base 100 → meia (4h liq, sem almoço)',
    in: { hora_entrada: '07:00', hora_saida: '11:00', valor_base: 100 },
    esperado: { tipo_diaria: 'meia', valor_diaria_aplicada: 50, horas_liquidas: 4, excede_12h: false },
  },
  {
    nome: 'C4 — 07:00→16:00, base exclusiva 150 → completa',
    in: { hora_entrada: '07:00', hora_saida: '16:00', valor_base: 150 },
    esperado: { tipo_diaria: 'completa', valor_diaria_aplicada: 150, horas_liquidas: 8, excede_12h: false },
  },
  {
    nome: 'C5 — só entrada (sem saída) → null/0',
    in: { hora_entrada: '07:00', hora_saida: null, valor_base: 100 },
    esperado: { tipo_diaria: null, valor_diaria_aplicada: 0, horas_liquidas: 0, excede_12h: false },
  },
  {
    nome: 'C6 — FDS 07:00→16:00, base exclusiva 150 → completa',
    in: { hora_entrada: '07:00', hora_saida: '16:00', valor_base: 150 },
    esperado: { tipo_diaria: 'completa', valor_diaria_aplicada: 150, horas_liquidas: 8, excede_12h: false },
  },

  // ===== Bordas =====
  {
    nome: 'Borda — exatamente 4:30 líquidas (bruta = 4:30, sem almoço) → completa',
    in: { hora_entrada: '07:00', hora_saida: '11:30', valor_base: 100 },
    esperado: { tipo_diaria: 'completa', valor_diaria_aplicada: 100, horas_liquidas: 4.5, excede_12h: false },
  },
  {
    nome: 'Borda — 4:29 líquidas → meia',
    in: { hora_entrada: '07:00', hora_saida: '11:29', valor_base: 100 },
    esperado: { tipo_diaria: 'meia', valor_diaria_aplicada: 50, horas_liquidas: 4 + 29 / 60, excede_12h: false },
  },
  {
    nome: 'Borda — exatamente 9:45 líquidas (bruta 10:45) → uma_e_meia',
    in: { hora_entrada: '07:00', hora_saida: '17:45', valor_base: 200 },
    esperado: { tipo_diaria: 'uma_e_meia', valor_diaria_aplicada: 300, horas_liquidas: 9.75, excede_12h: false },
  },
  {
    nome: 'Borda — bruta > 12h → uma_e_meia + excede_12h',
    in: { hora_entrada: '07:00', hora_saida: '20:30', valor_base: 100 },
    // bruta=13.5, excede12h=true → uma_e_meia x1.5. horas_liq=12.5 (bruta-1)
    esperado: { tipo_diaria: 'uma_e_meia', valor_diaria_aplicada: 150, horas_liquidas: 12.5, excede_12h: true },
  },
  {
    nome: 'Borda — exatamente 12h brutas (limite inferior, não excede) → uma_e_meia (liq=11)',
    in: { hora_entrada: '07:00', hora_saida: '19:00', valor_base: 100 },
    esperado: { tipo_diaria: 'uma_e_meia', valor_diaria_aplicada: 150, horas_liquidas: 11, excede_12h: false },
  },

  // ===== Turno noturno =====
  {
    nome: 'Noturno — 22:00→07:00 (+24h), base 100 → 9h bruta, 8h liq → completa',
    in: { hora_entrada: '22:00', hora_saida: '07:00', valor_base: 100 },
    esperado: { tipo_diaria: 'completa', valor_diaria_aplicada: 100, horas_liquidas: 8, excede_12h: false },
  },
  {
    nome: 'Noturno — 22:00→09:00 (+24h) → 11h bruta, 10h liq → uma_e_meia',
    in: { hora_entrada: '22:00', hora_saida: '09:00', valor_base: 100 },
    esperado: { tipo_diaria: 'uma_e_meia', valor_diaria_aplicada: 150, horas_liquidas: 10, excede_12h: false },
  },

  // ===== Casos degenerados / zero =====
  {
    nome: 'valor_base = 0 → null/0',
    in: { hora_entrada: '07:00', hora_saida: '16:00', valor_base: 0 },
    esperado: { tipo_diaria: null, valor_diaria_aplicada: 0, horas_liquidas: 0, excede_12h: false },
  },
  {
    nome: 'valor_base negativo → null/0',
    in: { hora_entrada: '07:00', hora_saida: '16:00', valor_base: -50 },
    esperado: { tipo_diaria: null, valor_diaria_aplicada: 0, horas_liquidas: 0, excede_12h: false },
  },
  {
    nome: 'hora_entrada null → null/0',
    in: { hora_entrada: null, hora_saida: '16:00', valor_base: 100 },
    esperado: { tipo_diaria: null, valor_diaria_aplicada: 0, horas_liquidas: 0, excede_12h: false },
  },
  {
    nome: 'entrada == saída → 0 minutos → nenhuma',
    in: { hora_entrada: '07:00', hora_saida: '07:00', valor_base: 100 },
    esperado: { tipo_diaria: 'nenhuma', valor_diaria_aplicada: 0, horas_liquidas: 0, excede_12h: false },
  },

  // ===== Arredondamento =====
  {
    nome: 'Arredondamento — base 99.99 × 1.5 = 149.985 → 149.99 (round2)',
    in: { hora_entrada: '07:00', hora_saida: '17:45', valor_base: 99.99 },
    esperado: { tipo_diaria: 'uma_e_meia', valor_diaria_aplicada: 149.99, horas_liquidas: 9.75, excede_12h: false },
  },
  {
    nome: 'Arredondamento — base 33.33 × 0.5 = 16.665 → 16.67',
    in: { hora_entrada: '07:00', hora_saida: '11:00', valor_base: 33.33 },
    esperado: { tipo_diaria: 'meia', valor_diaria_aplicada: 16.67, horas_liquidas: 4, excede_12h: false },
  },

  // ===== HH:MM:SS aceito (mesma semântica do TIME PG) =====
  {
    nome: 'Formato HH:MM:SS — 07:00:00→16:00:00 → completa',
    in: { hora_entrada: '07:00:00', hora_saida: '16:00:00', valor_base: 100 },
    esperado: { tipo_diaria: 'completa', valor_diaria_aplicada: 100, horas_liquidas: 8, excede_12h: false },
  },
];

describe('calcularDiariaAplicada — paridade com fn_calcular_diaria_aplicada (Fase 2.2)', () => {
  for (const caso of MATRIZ) {
    it(caso.nome, () => {
      const out = calcularDiariaAplicada(caso.in);
      expect(out.tipo_diaria).toBe(caso.esperado.tipo_diaria);
      expect(out.valor_diaria_aplicada).toBeCloseTo(caso.esperado.valor_diaria_aplicada, 2);
      expect(out.horas_liquidas).toBeCloseTo(caso.esperado.horas_liquidas, 6);
      expect(out.excede_12h).toBe(caso.esperado.excede_12h);
    });
  }
});

// Exporta a matriz para o teste de espelho frontend↔edge.
export { MATRIZ as MATRIZ_PARIDADE_DIARIA };
