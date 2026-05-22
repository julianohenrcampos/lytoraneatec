import { describe, it, expect } from 'vitest';
import { classificarDiaParaRelatorio, classificarDia } from '../classificacaoDiaRelatorio';

describe('classificarDiaParaRelatorio - modo snapshot (default)', () => {
  const feriados = new Set(['2026-04-21']); // Tiradentes

  it('21/04/2026 com snapshot=false → DIA_UTIL_SEMANA (override "normal")', () => {
    const r = classificarDiaParaRelatorio(
      { data: '2026-04-21', usar_diaria_exclusiva: false },
      feriados,
    );
    expect(r.grupo_relatorio).toBe('DIA_UTIL_SEMANA');
    expect(r.usar_valor_exclusivo).toBe(false);
    expect(r.origem_regra).toBe('snapshot_presenca');
  });

  it('21/04/2026 com snapshot=true → FINAL_SEMANA_FERIADO', () => {
    const r = classificarDiaParaRelatorio(
      { data: '2026-04-21', usar_diaria_exclusiva: true },
      feriados,
    );
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('snapshot_presenca');
  });

  it('22/04/2026 com snapshot=true → FINAL_SEMANA_FERIADO (ponte)', () => {
    const r = classificarDiaParaRelatorio(
      { data: '2026-04-22', usar_diaria_exclusiva: true },
      feriados,
    );
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('snapshot_presenca');
  });

  it('Modo snapshot IGNORA usar_diaria_exclusiva_calendario', () => {
    // Snapshot=false vence mesmo com calendário=true no modo financeiro/histórico.
    const r = classificarDiaParaRelatorio(
      {
        data: '2026-04-23',
        usar_diaria_exclusiva: false,
        usar_diaria_exclusiva_calendario: true,
      },
      feriados,
    );
    expect(r.grupo_relatorio).toBe('DIA_UTIL_SEMANA');
    expect(r.origem_regra).toBe('snapshot_presenca');
  });

  it('Fallback legado: 18/04/2026 (sábado) sem snapshot → fim_semana', () => {
    const r = classificarDiaParaRelatorio({ data: '2026-04-18' }, feriados);
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('fim_semana');
  });

  it('Fallback legado: 21/04/2026 feriado sem snapshot → calendario_feriado', () => {
    const r = classificarDiaParaRelatorio({ data: '2026-04-21' }, feriados);
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('calendario_feriado');
  });

  it('Fallback legado: 22/04/2026 sem snapshot → dia_util', () => {
    const r = classificarDiaParaRelatorio({ data: '2026-04-22' }, feriados);
    expect(r.grupo_relatorio).toBe('DIA_UTIL_SEMANA');
    expect(r.origem_regra).toBe('dia_util');
  });
});

describe('classificarDiaParaRelatorio - modo operacional', () => {
  const feriados = new Set(['2026-04-21']);

  it('calendário=true + snapshot=false → FS via calendario_operacional', () => {
    const r = classificarDiaParaRelatorio(
      {
        data: '2026-04-23',
        usar_diaria_exclusiva: false,
        usar_diaria_exclusiva_calendario: true,
      },
      feriados,
      { modo: 'operacional' },
    );
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('calendario_operacional');
  });

  it('calendário=false + snapshot=true → DS via calendario_operacional (override normal vence)', () => {
    const r = classificarDiaParaRelatorio(
      {
        data: '2026-04-21',
        usar_diaria_exclusiva: true,
        usar_diaria_exclusiva_calendario: false,
      },
      feriados,
      { modo: 'operacional' },
    );
    expect(r.grupo_relatorio).toBe('DIA_UTIL_SEMANA');
    expect(r.origem_regra).toBe('calendario_operacional');
  });

  it('calendário=null + snapshot=true → FS via snapshot_presenca', () => {
    const r = classificarDiaParaRelatorio(
      {
        data: '2026-04-22',
        usar_diaria_exclusiva: true,
        usar_diaria_exclusiva_calendario: null,
      },
      feriados,
      { modo: 'operacional' },
    );
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('snapshot_presenca');
  });

  it('calendário=null + snapshot=null + sábado → FS via fim_semana', () => {
    const r = classificarDiaParaRelatorio(
      { data: '2026-04-18' },
      feriados,
      { modo: 'operacional' },
    );
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('fim_semana');
  });

  it('calendário=null + snapshot=null + feriado nacional → FS via calendario_feriado', () => {
    const r = classificarDiaParaRelatorio(
      { data: '2026-04-21' },
      feriados,
      { modo: 'operacional' },
    );
    expect(r.grupo_relatorio).toBe('FINAL_SEMANA_FERIADO');
    expect(r.origem_regra).toBe('calendario_feriado');
  });
});

describe('classificarDia (wrapper)', () => {
  it('default snapshot: snapshot=true → fds_feriado', () => {
    expect(classificarDia({ data: '2026-04-22', usar_diaria_exclusiva: true })).toBe('fds_feriado');
  });

  it('default snapshot: ignora calendário', () => {
    expect(
      classificarDia({
        data: '2026-04-23',
        usar_diaria_exclusiva: false,
        usar_diaria_exclusiva_calendario: true,
      }),
    ).toBe('uteis');
  });

  it('modo operacional: calendário=true + snapshot=false → fds_feriado', () => {
    expect(
      classificarDia(
        {
          data: '2026-04-23',
          usar_diaria_exclusiva: false,
          usar_diaria_exclusiva_calendario: true,
        },
        undefined,
        { modo: 'operacional' },
      ),
    ).toBe('fds_feriado');
  });

  it('modo operacional: calendário=false + snapshot=true → uteis', () => {
    expect(
      classificarDia(
        {
          data: '2026-04-21',
          usar_diaria_exclusiva: true,
          usar_diaria_exclusiva_calendario: false,
        },
        new Set(['2026-04-21']),
        { modo: 'operacional' },
      ),
    ).toBe('uteis');
  });
});
