import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbookRomulo } from '../parseWorkbook';

function buildWorkbook(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'BASE ROMULO');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const HEADERS = ['ITEM','OBRA','DESCRIÇÃO OBRA','FROTA','TIPO DE EQUIPAMENTO','CONTRATO','FABRICANTE','MODELO','ANO FABRICAÇÃO','EMPRESA','C/ OPERADOR/ MOTORISTA ?','VALOR'];
const TITLE = [null, null, 'RELAÇÃO DE FROTA EM OBRAS'];

describe('parseWorkbookRomulo — regra oficial', () => {
  it('ITEM=#REF! + FROTA=LOC146 é linha útil', () => {
    const buf = buildWorkbook([TITLE, HEADERS, ['#REF!', 'A107', 'X', 'LOC146', 'ESCAVADEIRA']]);
    const r = parseWorkbookRomulo(buf, 'm.xlsx');
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].codigo_ativo_original).toBe('LOC146');
    expect(r.linhas[0].item_origem_invalido).toBe(true);
    expect(r.ignoradas).toHaveLength(0);
  });

  it('ITEM=#REF! + FROTA vazia → IGNORADA', () => {
    const buf = buildWorkbook([TITLE, HEADERS, ['#REF!', 'A107', 'X', null, 'ESCAVADEIRA']]);
    const r = parseWorkbookRomulo(buf, 'm.xlsx');
    expect(r.linhas).toHaveLength(0);
    expect(r.ignoradas[0].motivo).toBe('SEM_CODIGO_ATIVO');
  });

  it('marker "fim" na coluna FROTA é IGNORADA', () => {
    const buf = buildWorkbook([TITLE, HEADERS, [1, 'A107', 'x', 'LYC1'], [null, null, null, 'fim']]);
    const r = parseWorkbookRomulo(buf, 'm.xlsx');
    expect(r.linhas).toHaveLength(1);
    expect(r.ignoradas[0].motivo).toBe('FIM');
  });

  it('reconciliação total_bruto = linhas úteis + ignoradas', () => {
    const buf = buildWorkbook([
      TITLE, HEADERS,
      [1, 'A107', 'x', 'LYC1'],
      ['#REF!', 'A107', 'x', 'LOC146'],
      [3, 'A107', 'x', null],
      [4, 'A107', 'x', 'INVALID!!'],
    ]);
    const r = parseWorkbookRomulo(buf, 'm.xlsx');
    expect(r.totalBruto).toBe(r.linhas.length + r.ignoradas.length);
  });
});
