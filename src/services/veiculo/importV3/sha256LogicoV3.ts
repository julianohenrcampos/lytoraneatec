// PR-3.3 Fase C — SHA-256 LÓGICO do arquivo V3 simplificado.
// Turn 2 Fase C3: agora inclui `equipamento_id_erp` e `updated_at_origem`
// por linha, de modo que uma exportação antiga (mesmos valores visíveis, mas
// updated_at diferente) NUNCA reutilize o histórico de uma nova exportação.

import { chaveCapacidadeCanonica } from './capacidadeCanonica';
import { chaveAluguelCanonico } from './aluguelCanonico';
import {
  CABECALHOS_VISIVEIS_SIMPLIFICADO,
  CHAVE_CONTROLE_REF,
} from './equipamentosSchemaSimplificado';

export const SCHEMA_VERSION_SIMPLIFICADO = 'EQUIPAMENTOS_IMPORT_EXPORT_V3_SIMPLIFICADO' as const;
export type TipoArquivoV3 = 'MODELO' | 'EXPORTACAO';

/** Linha CRUA lida do XLSX: chaves = cabeçalhos oficiais + `_controle_ref`
 *  (e opcionalmente `equipamento_id_erp` + `updated_at_origem` quando origem = EXPORTACAO). */
export type LinhaCruaSimplificada = Partial<Record<string, string | number | null>>;

function trimUpper(v: unknown): string { return String(v ?? '').trim().toUpperCase(); }
function trimLower(v: unknown): string { return String(v ?? '').trim().toLowerCase(); }
function stripSeparadores(v: unknown): string { return String(v ?? '').replace(/[\s\-.\/]/g, '').toUpperCase(); }
function intOuNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(/^0+/, '') || '0');
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}
function txt(v: unknown): string { return String(v ?? '').trim(); }
function isoUtcOuNull(v: unknown): string | null {
  const s = txt(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export function calcularCodigoCanonico(linha: LinhaCruaSimplificada): string {
  const frota = trimUpper(linha['frota_codigo']);
  const num = intOuNull(linha['numero_frota']);
  if (!frota || num === null) return '';
  return `${frota}${num}`;
}

export function normalizarLinhaCanonica(linha: LinhaCruaSimplificada): Record<string, string | number | null> {
  return {
    frota_codigo:       trimUpper(linha['frota_codigo']) || null,
    numero_frota:       intOuNull(linha['numero_frota']),
    subcategoria:       txt(linha['subcategoria']) || null,
    linha_operacional:  txt(linha['linha_operacional']) || null,
    proprietario:       txt(linha['proprietario']) || null,
    centro_custo:       trimUpper(linha['centro_custo']) || null,
    fabricante:         txt(linha['fabricante']) || null,
    modelo:             trimLower(linha['modelo']) || null,
    ano_fabricacao:     intOuNull(linha['ano_fabricacao']),
    placa:              stripSeparadores(linha['placa']) || null,
    chassi:             stripSeparadores(linha['chassi']) || null,
    numero_serie:       stripSeparadores(linha['numero_serie']) || null,
    renavam:            stripSeparadores(linha['renavam']) || null,
    motor:              txt(linha['motor']) || null,
    cor:                trimLower(linha['cor']) || null,
    tipo_combustivel:   trimLower(linha['tipo_combustivel']) || null,
    capacidade:         chaveCapacidadeCanonica(linha['capacidade']),
    aluguel:            chaveAluguelCanonico(linha['aluguel']),
    departamento:       txt(linha['departamento']) || null,
    observacoes:        txt(linha['observacoes']) || null,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i += 1) hex += view[i].toString(16).padStart(2, '0');
  return hex;
}

export interface Sha256LogicoInput {
  tipo_arquivo: TipoArquivoV3;
  linhas: LinhaCruaSimplificada[];
}

/**
 * SHA-256 lógico do arquivo V3 simplificado.
 * Estável a: resave, ordenação, formatação equivalente.
 * Sensível a: alteração real de valor, updated_at_origem, inclusão/remoção.
 */
export async function calcularArquivoSha256LogicoV3(input: Sha256LogicoInput): Promise<string> {
  const linhasNormalizadas = input.linhas.map((l) => ({
    controle_ref:       txt(l[CHAVE_CONTROLE_REF]) || null,
    equipamento_id_erp: txt(l['equipamento_id_erp']) || null,
    updated_at_origem:  isoUtcOuNull(l['updated_at_origem']),
    codigo_canonico:    calcularCodigoCanonico(l) || null,
    canonica:           normalizarLinhaCanonica(l),
  }));

  // Ordenação estável: controle_ref → codigo_canonico → hash da linha.
  const comHash = await Promise.all(
    linhasNormalizadas.map(async (l) => ({
      ...l,
      hashLinha: await sha256Hex(stableStringify({
        eq: l.equipamento_id_erp, up: l.updated_at_origem, cc: l.canonica,
      })),
    })),
  );

  comHash.sort((a, b) => {
    const ka = a.controle_ref ?? `~${a.codigo_canonico ?? '~'}`;
    const kb = b.controle_ref ?? `~${b.codigo_canonico ?? '~'}`;
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.hashLinha < b.hashLinha ? -1 : a.hashLinha > b.hashLinha ? 1 : 0;
  });

  const payload = {
    schema_version: SCHEMA_VERSION_SIMPLIFICADO,
    tipo_arquivo:   input.tipo_arquivo,
    cabecalhos:     [...CABECALHOS_VISIVEIS_SIMPLIFICADO],
    linhas: comHash.map(({ controle_ref, equipamento_id_erp, updated_at_origem, codigo_canonico, canonica }) => ({
      controle_ref,
      equipamento_id_erp,
      updated_at_origem,
      codigo_canonico,
      canonica,
    })),
  };

  return sha256Hex(stableStringify(payload));
}
