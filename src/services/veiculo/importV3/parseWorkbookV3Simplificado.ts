// PR-3.3 Fase C2 — PARSER V3 SIMPLIFICADO (ExcelJS).
//
// Contrato aceito: EQUIPAMENTOS_IMPORT_EXPORT_V3_SIMPLIFICADO (via METADADOS).
// Qualquer outro schema_version (inclusive V3 41-colunas) → MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO.
//
// Zero escrita no banco. Zero side-effects. Zero mutação nos registros de entrada.

import ExcelJS from 'exceljs';
import {
  CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO,
  CABECALHOS_VISIVEIS_SIMPLIFICADO,
  CHAVE_CONTROLE_REF,
  TOTAL_COLUNAS_FISICAS_SIMPLIFICADO,
} from './equipamentosSchemaSimplificado';
import {
  ABA_EQUIPAMENTOS_V3S, ABA_CONTROLE_V3S, ABA_METADADOS_V3S,
} from './gerarWorkbookV3Simplificado';
import {
  SCHEMA_VERSION_SIMPLIFICADO,
  normalizarLinhaCanonica,
  calcularCodigoCanonico,
  type LinhaCruaSimplificada,
} from './sha256LogicoV3';

// ─── Códigos de status/erro ───────────────────────────────────────────────
export type AcaoInferida = 'INSERIR' | 'ATUALIZAR' | 'SEM_ALTERACAO' | 'IGNORADA' | 'ERRO';

export type CodigoErroSimplificadoV3 =
  | 'MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO'
  | 'ABA_AUSENTE'
  | 'CABECALHO_INVALIDO'
  | 'METADADOS_INVALIDOS'
  | 'CONTROLE_REF_AUSENTE'
  | 'CONTROLE_REF_DUPLICADO'
  | 'CONTROLE_REF_INVALIDO'
  | 'CAMPO_PROTEGIDO_ALTERADO'
  | 'IDENTIDADE_DUPLICADA'
  | 'CAPACIDADE_UNIDADE_INVALIDA'
  | 'ALUGUEL_INVALIDO';

export interface LinhaClassificadaSimplificada {
  linha_excel: number;
  acao: AcaoInferida;
  /** _controle_ref lido da linha (ou null). */
  controle_ref: string | null;
  /** codigo_canonico calculado (frota + numero sem zeros). */
  codigo_canonico: string;
  /** Tokens gerados automaticamente pelo diff. Vazio quando não há UPDATE. */
  campos_atualizar: string[];
  /** Snapshot canônico atual (linha após normalização). */
  atual_canonico: Record<string, string | number | null>;
  /** Snapshot canônico original (do _CONTROLE) — null quando INSERIR. */
  original_canonico: Record<string, string | number | null> | null;
  /** Erros de linha (0..N). Se houver ao menos um, acao = 'ERRO'. */
  erros: Array<{ codigo: CodigoErroSimplificadoV3; mensagem: string; campo?: string | null }>;
  /** Linha crua (chaves = cabeçalhos). Preservada para diagnóstico. */
  raw: Record<string, unknown>;
}

export interface ParseWorkbookV3SimplificadoResult {
  schema_version: string;
  tipo_arquivo: string;
  arquivo_sha256_logico: string | null;
  linhas: LinhaClassificadaSimplificada[];
  resumo: {
    total: number;
    inserir: number;
    atualizar: number;
    sem_alteracao: number;
    ignorada: number;
    erro: number;
  };
  erros_globais: Array<{ codigo: CodigoErroSimplificadoV3; mensagem: string; campo?: string | null }>;
}

// ─── Campos protegidos (nunca alteráveis por este importador) ─────────────
const CAMPOS_PROTEGIDOS = new Set(['frota_codigo', 'numero_frota', 'centro_custo']);

// ─── Mapa canônica → token ─────────────────────────────────────────────────
// Todo campo do payload canônico que muda gera um token do allowlist. Campos
// protegidos NUNCA geram token (produzem CAMPO_PROTEGIDO_ALTERADO).
const CHAVE_CANONICA_PARA_TOKEN: Record<string, string> = {
  subcategoria: 'SUBCATEGORIA',
  linha_operacional: 'LINHA_OPERACIONAL',
  proprietario: 'PROPRIETARIO',
  fabricante: 'FABRICANTE',
  modelo: 'MODELO',
  ano_fabricacao: 'ANO_FABRICACAO',
  placa: 'PLACA',
  chassi: 'CHASSI',
  numero_serie: 'NUMERO_SERIE',
  renavam: 'RENAVAM',
  motor: 'MOTOR',
  cor: 'COR',
  tipo_combustivel: 'TIPO_COMBUSTIVEL',
  capacidade: 'CAPACIDADE',
  aluguel: 'ALUGUEL',
  departamento: 'DEPARTAMENTO',
  observacoes: 'OBSERVACOES',
};

// ─── Utilidades ───────────────────────────────────────────────────────────
function celStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null && 'text' in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? '');
  }
  if (typeof v === 'object' && v !== null && 'result' in (v as Record<string, unknown>)) {
    return String((v as { result: unknown }).result ?? '');
  }
  return String(v);
}

function linhaCompletamenteVazia(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((v) => v === null || v === undefined || String(v).trim() === '');
}

function extrairCabecalho(ws: ExcelJS.Worksheet): string[] {
  const header: string[] = [];
  const row1 = ws.getRow(1);
  row1.eachCell({ includeEmpty: true }, (cell, col) => {
    header[col - 1] = celStr(cell.value).trim();
  });
  return header;
}

// ─── Núcleo público ───────────────────────────────────────────────────────
export async function parseWorkbookV3Simplificado(
  buffer: ArrayBuffer,
): Promise<ParseWorkbookV3SimplificadoResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const errosGlobais: ParseWorkbookV3SimplificadoResult['erros_globais'] = [];

  // ── METADADOS ────────────────────────────────────────────────────────────
  const wsMeta = wb.getWorksheet(ABA_METADADOS_V3S);
  if (!wsMeta) {
    errosGlobais.push({
      codigo: 'MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO',
      mensagem: `Aba ${ABA_METADADOS_V3S} ausente — este arquivo não é do layout simplificado.`,
    });
    return vazio(errosGlobais);
  }
  const meta: Record<string, string> = {};
  wsMeta.eachRow({ includeEmpty: false }, (row, num) => {
    if (num === 1) return;
    const k = celStr(row.getCell(1).value).trim();
    const v = celStr(row.getCell(2).value).trim();
    if (k) meta[k] = v;
  });

  const schema = meta.schema_version ?? '';
  const tipoArquivo = meta.tipo_arquivo ?? '';
  if (schema !== SCHEMA_VERSION_SIMPLIFICADO) {
    errosGlobais.push({
      codigo: 'MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO',
      campo: 'schema_version',
      mensagem: `schema_version esperado "${SCHEMA_VERSION_SIMPLIFICADO}", recebido "${schema}". Baixe o novo modelo.`,
    });
    return { ...vazio(errosGlobais), schema_version: schema, tipo_arquivo: tipoArquivo };
  }

  // ── EQUIPAMENTOS ─────────────────────────────────────────────────────────
  const wsEq = wb.getWorksheet(ABA_EQUIPAMENTOS_V3S);
  if (!wsEq) {
    errosGlobais.push({ codigo: 'ABA_AUSENTE', mensagem: `Aba obrigatória "${ABA_EQUIPAMENTOS_V3S}" ausente.` });
    return vazio(errosGlobais);
  }

  const header = extrairCabecalho(wsEq);
  const esperado = [...CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO];
  if (header.length < TOTAL_COLUNAS_FISICAS_SIMPLIFICADO) {
    errosGlobais.push({
      codigo: 'CABECALHO_INVALIDO',
      mensagem: `EQUIPAMENTOS deve ter ${TOTAL_COLUNAS_FISICAS_SIMPLIFICADO} colunas; encontrou ${header.length}.`,
    });
    return vazio(errosGlobais);
  }
  for (let i = 0; i < esperado.length; i += 1) {
    if (header[i] !== esperado[i]) {
      errosGlobais.push({
        codigo: 'CABECALHO_INVALIDO',
        campo: esperado[i],
        mensagem: `Coluna ${i + 1}: esperada "${esperado[i]}", recebida "${header[i] ?? ''}".`,
      });
    }
  }
  if (errosGlobais.length > 0) return vazio(errosGlobais);

  // ── _CONTROLE ────────────────────────────────────────────────────────────
  const wsCtrl = wb.getWorksheet(ABA_CONTROLE_V3S);
  const controle = new Map<string, {
    equipamento_id_erp: string;
    updated_at_origem: string;
    codigo_canonico: string;
    snapshot: Record<string, string | number | null>;
  }>();
  const controleIdentidades = new Map<string, string>(); // codigo_canonico → controle_ref
  if (wsCtrl) {
    wsCtrl.eachRow({ includeEmpty: false }, (row, num) => {
      if (num === 1) return;
      const ref = celStr(row.getCell(1).value).trim();
      if (!ref) return;
      const eq = celStr(row.getCell(2).value).trim();
      const upd = celStr(row.getCell(3).value).trim();
      const codc = celStr(row.getCell(4).value).trim();
      const snapRaw = celStr(row.getCell(5).value);
      let snap: Record<string, string | number | null> = {};
      try { snap = snapRaw ? JSON.parse(snapRaw) : {}; } catch { snap = {}; }
      controle.set(ref, { equipamento_id_erp: eq, updated_at_origem: upd, codigo_canonico: codc, snapshot: snap });
      if (codc) controleIdentidades.set(codc.toUpperCase(), ref);
    });
  }

  // ── LINHAS ───────────────────────────────────────────────────────────────
  const linhas: LinhaClassificadaSimplificada[] = [];
  const contagemRefs = new Map<string, number>();
  const contagemIdentidades = new Map<string, number>();

  // Descobre a última linha com dados.
  const lastRow = wsEq.actualRowCount;
  for (let n = 2; n <= lastRow; n += 1) {
    const rowObj = wsEq.getRow(n);
    const raw: Record<string, unknown> = {};
    for (let c = 0; c < esperado.length; c += 1) {
      raw[esperado[c]] = rowObj.getCell(c + 1).value;
    }
    if (linhaCompletamenteVazia(raw)) continue;

    const refCru = celStr(raw[CHAVE_CONTROLE_REF]).trim() || null;
    const canonicaAtual = normalizarLinhaCanonica(raw as LinhaCruaSimplificada);
    const codigoCanonico = calcularCodigoCanonico(raw as LinhaCruaSimplificada);

    if (refCru) contagemRefs.set(refCru, (contagemRefs.get(refCru) ?? 0) + 1);
    if (codigoCanonico) contagemIdentidades.set(codigoCanonico, (contagemIdentidades.get(codigoCanonico) ?? 0) + 1);

    const linha: LinhaClassificadaSimplificada = {
      linha_excel: n,
      acao: 'IGNORADA',
      controle_ref: refCru,
      codigo_canonico: codigoCanonico,
      campos_atualizar: [],
      atual_canonico: canonicaAtual,
      original_canonico: null,
      erros: [],
      raw,
    };

    // Classificação:
    if (!refCru) {
      // Sem _controle_ref: pode ser INSERIR OU CONTROLE_REF_AUSENTE (se identidade existe em _CONTROLE).
      if (codigoCanonico && controleIdentidades.has(codigoCanonico.toUpperCase())) {
        linha.acao = 'ERRO';
        linha.erros.push({
          codigo: 'CONTROLE_REF_AUSENTE',
          campo: CHAVE_CONTROLE_REF,
          mensagem: `Identidade ${codigoCanonico} já existe em _CONTROLE — restaure o _controle_ref original ou baixe uma nova exportação.`,
        });
      } else {
        linha.acao = 'INSERIR';
      }
    } else {
      // Com _controle_ref: precisa existir em _CONTROLE.
      const ctrl = controle.get(refCru);
      if (!ctrl) {
        linha.acao = 'ERRO';
        linha.erros.push({
          codigo: 'CONTROLE_REF_INVALIDO',
          campo: CHAVE_CONTROLE_REF,
          mensagem: `_controle_ref "${refCru}" não consta em _CONTROLE.`,
        });
      } else {
        linha.original_canonico = ctrl.snapshot;
        // Diff canônico
        const diffs = diffCanonico(ctrl.snapshot, canonicaAtual);
        // Campos protegidos alterados?
        const protegidosAlterados = diffs.filter((d) => CAMPOS_PROTEGIDOS.has(d));
        if (protegidosAlterados.length > 0) {
          linha.acao = 'ERRO';
          for (const p of protegidosAlterados) {
            linha.erros.push({
              codigo: 'CAMPO_PROTEGIDO_ALTERADO',
              campo: p,
              mensagem: `Campo "${p}" é protegido — não pode ser alterado por importação.`,
            });
          }
        } else if (diffs.length === 0) {
          linha.acao = 'SEM_ALTERACAO';
        } else {
          linha.acao = 'ATUALIZAR';
          const tokens = new Set<string>();
          for (const d of diffs) {
            const t = CHAVE_CANONICA_PARA_TOKEN[d];
            if (t) tokens.add(t);
          }
          linha.campos_atualizar = [...tokens].sort();
        }
      }
    }

    linhas.push(linha);
  }

  // Segunda passada: duplicidade de _controle_ref e de identidade
  for (const l of linhas) {
    if (l.controle_ref && (contagemRefs.get(l.controle_ref) ?? 0) > 1) {
      l.acao = 'ERRO';
      l.erros.push({
        codigo: 'CONTROLE_REF_DUPLICADO',
        campo: CHAVE_CONTROLE_REF,
        mensagem: `_controle_ref "${l.controle_ref}" aparece em ${contagemRefs.get(l.controle_ref)} linhas.`,
      });
    }
    if (l.acao === 'INSERIR' && l.codigo_canonico && (contagemIdentidades.get(l.codigo_canonico) ?? 0) > 1) {
      l.acao = 'ERRO';
      l.erros.push({
        codigo: 'IDENTIDADE_DUPLICADA',
        mensagem: `Identidade "${l.codigo_canonico}" aparece em ${contagemIdentidades.get(l.codigo_canonico)} linhas — resolva antes de importar.`,
      });
    }
  }

  const resumo = {
    total: linhas.length,
    inserir: linhas.filter((l) => l.acao === 'INSERIR').length,
    atualizar: linhas.filter((l) => l.acao === 'ATUALIZAR').length,
    sem_alteracao: linhas.filter((l) => l.acao === 'SEM_ALTERACAO').length,
    ignorada: linhas.filter((l) => l.acao === 'IGNORADA').length,
    erro: linhas.filter((l) => l.acao === 'ERRO').length,
  };

  return {
    schema_version: schema,
    tipo_arquivo: tipoArquivo,
    arquivo_sha256_logico: meta.arquivo_sha256_logico ?? null,
    linhas,
    resumo,
    erros_globais: errosGlobais,
  };
}

function diffCanonico(
  original: Record<string, string | number | null>,
  atual: Record<string, string | number | null>,
): string[] {
  const chaves = new Set([...Object.keys(original ?? {}), ...Object.keys(atual ?? {})]);
  const out: string[] = [];
  for (const k of chaves) {
    const a = normaliza(original?.[k]);
    const b = normaliza(atual?.[k]);
    if (a !== b) out.push(k);
  }
  return out;
}

function normaliza(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function vazio(erros: ParseWorkbookV3SimplificadoResult['erros_globais']): ParseWorkbookV3SimplificadoResult {
  return {
    schema_version: '', tipo_arquivo: '', arquivo_sha256_logico: null,
    linhas: [], resumo: { total: 0, inserir: 0, atualizar: 0, sem_alteracao: 0, ignorada: 0, erro: 0 },
    erros_globais: erros,
  };
}

// ─── Rejeição explícita do formato 41-colunas ─────────────────────────────
/** Utilitário público: dado um cabeçalho da aba EQUIPAMENTOS, decide se é V3-41 (legado). */
export function pareceLayoutCompleto41(cabecalho: readonly string[]): boolean {
  return (
    cabecalho.length >= 40 &&
    cabecalho[0] === 'acao' &&
    cabecalho.includes('equipamento_id_erp') &&
    cabecalho.includes('campos_atualizar')
  );
}
