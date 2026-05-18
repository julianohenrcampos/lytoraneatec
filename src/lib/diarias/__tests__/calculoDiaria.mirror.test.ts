/**
 * Fase 2.3 — P2: Espelho frontend ↔ edge.
 *
 * Roda a MESMA matriz de entradas contra:
 *   - src/lib/diarias/calculoDiaria.ts          (helper frontend)
 *   - supabase/functions/_shared/calculoDiaria.ts (espelho Deno)
 *
 * Falha se qualquer caso divergir em tipo, valor, horas_liq ou excede_12h.
 * Também garante que o conteúdo dos dois arquivos contém as mesmas regras
 * críticas (thresholds 9.75 / 4.5 / multiplicadores 1.5/1.0/0.5).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calcularDiariaAplicada as fnFront } from '@/lib/diarias/calculoDiaria';
import { calcularDiariaAplicada as fnEdge } from '../../../../supabase/functions/_shared/calculoDiaria';
import { MATRIZ_PARIDADE_DIARIA } from './calculoDiaria.parity.test';

describe('calculoDiaria — espelho frontend ↔ edge (_shared)', () => {
  for (const caso of MATRIZ_PARIDADE_DIARIA) {
    it(`espelho: ${caso.nome}`, () => {
      const a = fnFront(caso.in);
      const b = fnEdge(caso.in);
      expect(b.tipo_diaria).toBe(a.tipo_diaria);
      expect(b.valor_diaria_aplicada).toBeCloseTo(a.valor_diaria_aplicada, 2);
      expect(b.horas_liquidas).toBeCloseTo(a.horas_liquidas, 6);
      expect(b.excede_12h).toBe(a.excede_12h);
    });
  }

  it('ambos os arquivos contêm os thresholds críticos idênticos', () => {
    const front = readFileSync(resolve(__dirname, '../calculoDiaria.ts'), 'utf8');
    const edge = readFileSync(
      resolve(__dirname, '../../../../supabase/functions/_shared/calculoDiaria.ts'),
      'utf8',
    );
    for (const marcador of ['horasLiq >= 9.75', 'horasLiq >= 4.5', 'horasBrutas > 12', 'mult = 1.5', 'mult = 1.0', 'mult = 0.5']) {
      expect(front).toContain(marcador);
      expect(edge).toContain(marcador);
    }
  });
});
