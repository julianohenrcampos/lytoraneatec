import * as XLSX from 'xlsx';
import { mapHeaderRow } from './headerAliases';
import { splitCodigoAtivo, isFimMarker } from './splitCodigoAtivo';
import type { LinhaCanonica } from './types';

const ABA_OFICIAL = 'BASE ROMULO';
const LINHA_CABECALHO = 2;
const PRIMEIRA_LINHA_DADOS = 3;

const REF_ERROR_MARKERS = new Set(['#REF!', '#N/A', '#VALUE!', '#NAME?', '#DIV/0!', '#NULL!', '#NUM!']);

function itemRawText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function isItemInvalido(raw: string | null): boolean {
  if (raw === null) return true;
  if (REF_ERROR_MARKERS.has(raw.toUpperCase())) return true;
  return !/^\d+$/.test(raw);
}

export interface ParseWorkbookResult {
  aba: string;
  totalBruto: number;
  linhas: LinhaCanonica[];
  ignoradas: Array<{
    linha_excel: number;
    motivo: 'SEM_CODIGO_ATIVO' | 'ITEM_INVALIDO' | 'FIM' | 'FORMATO_CODIGO_INVALIDO';
    codigo_ativo_original: string | null;
  }>;
  ultimaLinhaSignificativa: number;
}

/**
 * REGRA OFICIAL DE LINHA ÚTIL (Rodada 1):
 *  1. FROTA preenchida.
 *  2. FROTA !== "fim".
 *  3. FROTA casa com ^([A-Z]{2,4})(\d{1,6})$.
 * ITEM inválido/#REF! NÃO descarta a linha se FROTA for válida.
 */
export function parseWorkbookRomulo(buffer: ArrayBuffer, arquivoNome: string): ParseWorkbookResult {
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: false, cellDates: false });
  if (!wb.SheetNames.includes(ABA_OFICIAL)) {
    throw new Error(`Aba "${ABA_OFICIAL}" não encontrada em ${arquivoNome}. Abas: ${wb.SheetNames.join(', ')}`);
  }
  const ws = wb.Sheets[ABA_OFICIAL];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: null });

  if (rows.length < PRIMEIRA_LINHA_DADOS) {
    throw new Error(`Aba "${ABA_OFICIAL}" com menos de 3 linhas.`);
  }

  const headerRow = rows[LINHA_CABECALHO - 1] as unknown[];
  const idx = mapHeaderRow(headerRow);
  if (idx.frota === undefined) {
    throw new Error(`Coluna FROTA não encontrada no cabeçalho da aba "${ABA_OFICIAL}".`);
  }

  let ultimaSignificativa = PRIMEIRA_LINHA_DADOS - 1;
  for (let i = rows.length - 1; i >= PRIMEIRA_LINHA_DADOS - 1; i--) {
    const r = rows[i] ?? [];
    if (r.some((c) => c !== null && c !== undefined && String(c).trim() !== '')) {
      ultimaSignificativa = i + 1;
      break;
    }
  }

  const totalBruto = ultimaSignificativa - PRIMEIRA_LINHA_DADOS + 1;
  const linhasUteis: LinhaCanonica[] = [];
  const ignoradas: ParseWorkbookResult['ignoradas'] = [];

  const get = (r: unknown[], k: string): unknown => (idx[k] === undefined ? null : r[idx[k]] ?? null);
  const asText = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  for (let excelRow = PRIMEIRA_LINHA_DADOS; excelRow <= ultimaSignificativa; excelRow++) {
    const r = (rows[excelRow - 1] as unknown[]) ?? [];
    const frotaRaw = get(r, 'frota');
    const itemRaw = itemRawText(get(r, 'item'));

    if (isFimMarker(frotaRaw)) {
      ignoradas.push({ linha_excel: excelRow, motivo: 'FIM', codigo_ativo_original: 'fim' });
      continue;
    }

    const split = splitCodigoAtivo(frotaRaw);
    if (!split.original) {
      ignoradas.push({ linha_excel: excelRow, motivo: 'SEM_CODIGO_ATIVO', codigo_ativo_original: null });
      continue;
    }
    if (!split.ok) {
      ignoradas.push({ linha_excel: excelRow, motivo: 'FORMATO_CODIGO_INVALIDO', codigo_ativo_original: split.original });
      continue;
    }

    linhasUteis.push({
      aba_origem: ABA_OFICIAL,
      linha_excel: excelRow,
      item_origem_raw: itemRaw,
      item_origem_invalido: isItemInvalido(itemRaw),
      codigo_ativo_original: split.original,
      obra_codigo: asText(get(r, 'obra')),
      obra_descricao: asText(get(r, 'obra_descricao')),
      tipo_equipamento_raw: asText(get(r, 'tipo')),
      contrato: asText(get(r, 'contrato')),
      fabricante_raw: asText(get(r, 'fabricante')),
      modelo_raw: asText(get(r, 'modelo')),
      ano_fabricacao_raw: asText(get(r, 'ano')),
      empresa_raw: asText(get(r, 'empresa')),
      com_operador: asText(get(r, 'operador')),
      valor_raw: asText(get(r, 'valor')),
      extras: {},
      numero_frota_prefixo: split.prefixo,
      numero_frota_numero: split.numero,
      numero_frota_canonico: split.canonico,
      regex_ok: true,
    });
  }

  return { aba: ABA_OFICIAL, totalBruto, linhas: linhasUteis, ignoradas, ultimaLinhaSignificativa: ultimaSignificativa };
}
