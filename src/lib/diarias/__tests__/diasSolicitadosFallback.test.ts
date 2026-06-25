import { describe, it, expect } from 'vitest';
import {
  resolverDiasSolicitadosItem,
  itemConvocadoNaData,
} from '@/utils/diariasDiasSolicitadosFallback';
import type { DataClassificada } from '@/utils/diariasPeriodoUtils';

const datas: DataClassificada[] = [
  { data: '2026-05-11', tipo: 'util' },     // seg
  { data: '2026-05-12', tipo: 'util' },     // ter
  { data: '2026-05-16', tipo: 'sabado' },   // sáb
  { data: '2026-05-17', tipo: 'fds' },      // dom
  { data: '2026-05-18', tipo: 'feriado' },  // feriado
];

describe('diariasDiasSolicitadosFallback', () => {
  it('usa dias_solicitados quando presente (origem=campo)', () => {
    const r = resolverDiasSolicitadosItem(
      { funcionario_id: 'f1', dias_solicitados: ['2026-05-11'] },
      { datasClassificadas: datas, consideraFdsFeriado: true },
    );
    expect(r.origem).toBe('campo');
    expect(r.dias).toEqual(['2026-05-11']);
  });

  it('fallback legado com FDS=false usa apenas util+sabado', () => {
    const r = resolverDiasSolicitadosItem(
      { funcionario_id: 'f1' },
      { datasClassificadas: datas, consideraFdsFeriado: false },
    );
    expect(r.origem).toBe('legado_periodo');
    expect(r.dias).toEqual(['2026-05-11', '2026-05-12', '2026-05-16']);
  });

  it('fallback legado com FDS=true usa todas as datas', () => {
    const r = resolverDiasSolicitadosItem(
      { funcionario_id: 'f1', dias_solicitados: null as unknown },
      { datasClassificadas: datas, consideraFdsFeriado: true },
    );
    expect(r.origem).toBe('legado_periodo');
    expect(r.dias).toHaveLength(5);
  });

  it('array vazio é tratado como legado', () => {
    const r = resolverDiasSolicitadosItem(
      { funcionario_id: 'f1', dias_solicitados: [] },
      { datasClassificadas: datas, consideraFdsFeriado: false },
    );
    expect(r.origem).toBe('legado_periodo');
  });

  it('coexistência item-a-item: cada item resolve sua própria origem', () => {
    const novo = resolverDiasSolicitadosItem(
      { funcionario_id: 'a', dias_solicitados: ['2026-05-12'] },
      { datasClassificadas: datas, consideraFdsFeriado: false },
    );
    const legado = resolverDiasSolicitadosItem(
      { funcionario_id: 'b' },
      { datasClassificadas: datas, consideraFdsFeriado: false },
    );
    expect(novo.origem).toBe('campo');
    expect(legado.origem).toBe('legado_periodo');
  });

  it('itemConvocadoNaData: legado convoca em qualquer data do período', () => {
    const r = itemConvocadoNaData(
      { funcionario_id: 'b' },
      '2026-05-16',
      { datasClassificadas: datas, consideraFdsFeriado: false },
    );
    expect(r.convocado).toBe(true);
    expect(r.origem).toBe('legado_periodo');
  });

  it('itemConvocadoNaData: item novo respeita dias_solicitados', () => {
    const r = itemConvocadoNaData(
      { funcionario_id: 'a', dias_solicitados: ['2026-05-12'] },
      '2026-05-16',
      { datasClassificadas: datas, consideraFdsFeriado: true },
    );
    expect(r.convocado).toBe(false);
    expect(r.origem).toBe('campo');
  });
});
