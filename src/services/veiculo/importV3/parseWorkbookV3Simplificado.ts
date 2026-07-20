// PR-3.3 Fase C2/C4 — PARSER V3 SIMPLIFICADO (SheetJS para leitura).
//
// Correções obrigatórias (13-pontos):
//   1. _LISTAS lidas do próprio XLSX — nada de DB no preview.
//   2. Null-safety total nos lookups (nenhum acesso a .name/.id_erp/.contexto
//      sem checagem prévia).
//   3. Erros classificados em: FATAIS (bloqueiam preview), WARNINGS globais e
//      erros de linha (não bloqueiam demais linhas).
//   4. used range via SheetJS — nunca depende de table.ref.
//   5. try/catch por linha — TypeError vira ERRO_INTERNO_LINHA, jamais
//      MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO.
//   6. Zero escrita no banco, zero side-effects.

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO,
  CHAVE_CONTROLE_REF,
  TOTAL_COLUNAS_FISICAS_SIMPLIFICADO,
} from './equipamentosSchemaSimplificado';
import {
  ABA_EQUIPAMENTOS_V3S, ABA_CONTROLE_V3S, ABA_METADADOS_V3S, ABA_LISTAS_V3S,
} from './gerarWorkbookV3Simplificado';
import {
  SCHEMA_VERSION_SIMPLIFICADO,
  normalizarLinhaCanonica,
  calcularCodigoCanonico,
  type LinhaCruaSimplificada,
} from './sha256LogicoV3';
import type {
  ItemListaV3,
  ListasReferenciaV3,
  TipoCatalogoV3,
  ContextoProprietario,
} from './carregarListasReferenciaV3';

// ─── Códigos de status/erro ───────────────────────────────────────────────
export type AcaoInferida = 'INSERIR' | 'ATUALIZAR' | 'SEM_ALTERACAO' | 'IGNORADA' | 'ERRO';

// Códigos FATAIS — bloqueiam preview inteiro.
export const CODIGOS_FATAIS = [
  'MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO',
  'ABA_EQUIPAMENTOS_AUSENTE',
  'ABA_LISTAS_AUSENTE',
  'ABA_CONTROLE_AUSENTE',
  'ABA_METADADOS_AUSENTE',
  'CABECALHO_INVALIDO',
  'SCHEMA_VERSION_INCOMPATIVEL',
  'XLSX_CORROMPIDO',
] as const;

export type CodigoErroSimplificadoV3 =
  // Fatais
  | 'MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO'
  | 'ABA_EQUIPAMENTOS_AUSENTE'
  | 'ABA_LISTAS_AUSENTE'
  | 'ABA_CONTROLE_AUSENTE'
  | 'ABA_METADADOS_AUSENTE'
  | 'CABECALHO_INVALIDO'
  | 'SCHEMA_VERSION_INCOMPATIVEL'
  | 'XLSX_CORROMPIDO'
  // Warnings globais
  | 'TABELA_EXCEL_NAO_EXPANDIDA'
  | 'LINHA_LISTA_INVALIDA_IGNORADA'
  | 'METADADO_OPCIONAL_AUSENTE'
  // Erros de linha — estrutura/identidade
  | 'CONTROLE_REF_AUSENTE'
  | 'CONTROLE_REF_DUPLICADO'
  | 'CONTROLE_REF_INVALIDO'
  | 'CAMPO_PROTEGIDO_ALTERADO'
  | 'IDENTIDADE_DUPLICADA'
  | 'FROTA_OBRIGATORIA'
  | 'FROTA_NAO_RESOLVIDA'
  | 'NUMERO_FROTA_OBRIGATORIO'
  // Erros de linha — obrigatoriedade + resolução
  | 'PROPRIETARIO_OBRIGATORIO'
  | 'PROPRIETARIO_NAO_RESOLVIDO'
  | 'PROPRIETARIO_AMBIGUO'
  | 'SUBCATEGORIA_OBRIGATORIA'
  | 'SUBCATEGORIA_NAO_RESOLVIDA'
  | 'CENTRO_CUSTO_OBRIGATORIO'
  | 'CENTRO_CUSTO_NAO_RESOLVIDO'
  | 'FABRICANTE_NAO_RESOLVIDO'
  | 'DEPARTAMENTO_NAO_RESOLVIDO'
  | 'LINHA_OPERACIONAL_NAO_RESOLVIDA'
  // Erros de linha — normalização
  | 'CAPACIDADE_UNIDADE_INVALIDA'
  | 'ALUGUEL_INVALIDO'
  // Fallback inesperado
  | 'ERRO_INTERNO_LINHA';

export interface ErroLinhaSimplificadoV3 {
  codigo: CodigoErroSimplificadoV3;
  mensagem: string;
  campo?: string | null;
}

export interface LinhaClassificadaSimplificada {
  linha_excel: number;
  acao: AcaoInferida;
  /** Ação inferida original antes de virar ERRO (para o preview explicar contexto). */
  acao_inferida?: AcaoInferida;
  controle_ref: string | null;
  codigo_canonico: string;
  campos_atualizar: string[];
  atual_canonico: Record<string, string | number | null>;
  original_canonico: Record<string, string | number | null> | null;
  erros: ErroLinhaSimplificadoV3[];
  raw: Record<string, unknown>;
  elegivel?: boolean;
}

export interface ParseWorkbookV3SimplificadoResult {
  schema_version: string;
  tipo_arquivo: string;
  arquivo_sha256_logico: string | null;
  linhas: LinhaClassificadaSimplificada[];
  /** Catálogos lidos DIRETAMENTE da aba _LISTAS do XLSX (sem DB). */
  listas: ListasReferenciaV3;
  resumo: {
    total: number;
    inserir: number;
    atualizar: number;
    sem_alteracao: number;
    ignorada: number;
    erro: number;
    linhas_com_erro: number;
    total_inconsistencias: number;
  };
  erros_globais: ErroLinhaSimplificadoV3[];
  warnings_globais: ErroLinhaSimplificadoV3[];
}

// ─── Campos protegidos ─────────────────────────────────────────────────────
// FASE C4: `centro_custo` deixa de ser protegido — sua alteração vira o
// token CENTRO_CUSTO, aplicado atomicamente pela RPC. Frota e número
// permanecem imutáveis por importação (fazem parte da identidade canônica).
const CAMPOS_PROTEGIDOS = new Set(['frota_codigo', 'numero_frota']);

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
  centro_custo: 'CENTRO_CUSTO',
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

function txtNorm(v: unknown): string {
  return celStr(v).trim();
}

function upperNorm(v: unknown): string {
  return txtNorm(v).toUpperCase();
}

function linhaCompletamenteVazia(raw: Record<string, unknown>): boolean {
  return Object.values(raw).every((v) => v === null || v === undefined || String(v).trim() === '');
}

function rangeDaPlanilha(ws: XLSX.WorkSheet): XLSX.Range | null {
  const ref = ws['!ref'];
  if (!ref) return null;
  try { return XLSX.utils.decode_range(ref); } catch { return null; }
}

function valorCelula(ws: XLSX.WorkSheet, row1: number, col1: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row1 - 1, c: col1 - 1 });
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (!cell) return '';
  return cell.v ?? cell.w ?? '';
}

function extrairCabecalho(ws: XLSX.WorkSheet): string[] {
  const header: string[] = [];
  const range = rangeDaPlanilha(ws);
  const fimCol = Math.max(range?.e.c ?? 0, TOTAL_COLUNAS_FISICAS_SIMPLIFICADO - 1);
  for (let c = 0; c <= fimCol; c += 1) header[c] = celStr(valorCelula(ws, 1, c + 1)).trim();
  return header;
}

// ─── Leitura da aba _LISTAS embutida ──────────────────────────────────────
const COLUNAS_LISTAS_ESPERADAS = [
  'tipo_catalogo', 'id_erp', 'valor_exibicao', 'codigo', 'nome',
  'parent_id_erp', 'ativo', 'vinculado_atualmente', 'contexto',
] as const;

const COLUNAS_LISTAS_SEIS = [
  'tipo_catalogo', 'id_erp', 'valor_exibicao', 'ativo', 'vinculado_atualmente', 'contexto',
] as const;

function derivarNomeProprietario(valorExibicao: string): string {
  // "EMPRESA | Acme (12ab34)" → "Acme"; "LOCADORA | Locasa" → "Locasa"
  const semPrefixo = valorExibicao.replace(/^\s*(EMPRESA|LOCADORA)\s*\|\s*/i, '');
  return semPrefixo.replace(/\s*\([0-9a-f]{6,}\)\s*$/i, '').trim() || valorExibicao;
}

function removerPrefixoProprietario(valorExibicao: string): string {
  return valorExibicao.replace(/^\s*(EMPRESA|LOCADORA)\s*\|\s*/i, '').trim();
}

function normalizarComparacao(valor: unknown): string {
  return txtNorm(valor).replace(/\s+/g, ' ').toUpperCase();
}

function colunasListasCompativeis(header: string[]): boolean {
  const seis = COLUNAS_LISTAS_SEIS.every((h, i) => header[i] === h);
  const nove = COLUNAS_LISTAS_ESPERADAS.every((h, i) => header[i] === h);
  return seis || nove;
}

function derivarContexto(valor: string, valorExibicao: string): ContextoProprietario {
  const v = valor.trim().toUpperCase();
  if (v === 'EMPRESA' || v === 'LOCADORA') return v as ContextoProprietario;
  if (/^\s*EMPRESA\s*\|/i.test(valorExibicao)) return 'EMPRESA';
  if (/^\s*LOCADORA\s*\|/i.test(valorExibicao)) return 'LOCADORA';
  return null;
}

function lerAbaListas(
  ws: XLSX.WorkSheet,
  warnings: ErroLinhaSimplificadoV3[],
): ListasReferenciaV3 {
  const header = extrairCabecalho(ws);
  const idxDe: Record<string, number> = {};
  header.forEach((h, i) => { if (h) idxDe[h] = i + 1; });

  if (!colunasListasCompativeis(header)) {
    warnings.push({
      codigo: 'LINHA_LISTA_INVALIDA_IGNORADA',
      mensagem: `_LISTAS usa cabeçalho não reconhecido. Aceitos: 6 colunas atuais ou 9 colunas estendidas.`,
    });
  }

  const itens: ItemListaV3[] = [];
  const range = rangeDaPlanilha(ws);
  const lastRow = (range?.e.r ?? 0) + 1;

  for (let n = 2; n <= lastRow; n += 1) {
    try {
      const get = (col: string): string => {
        const c = idxDe[col];
        return c ? txtNorm(valorCelula(ws, n, c)) : '';
      };

      const tipoCatalogo = get('tipo_catalogo').toUpperCase();
      const idErp = get('id_erp');
      const valorExibicao = get('valor_exibicao');

      if (!tipoCatalogo && !idErp && !valorExibicao) continue; // vazia

      if (!tipoCatalogo || !idErp || !valorExibicao) {
        warnings.push({
          codigo: 'LINHA_LISTA_INVALIDA_IGNORADA',
          mensagem: `_LISTAS linha ${n} ignorada (tipo/id/valor obrigatórios).`,
        });
        continue;
      }

      const formatoSeis = !idxDe.codigo && !idxDe.nome && !idxDe.parent_id_erp;
      const codigo = get('codigo') || (formatoSeis && ['FROTA', 'CENTRO_CUSTO', 'LINHA_OPERACIONAL'].includes(tipoCatalogo)
        ? valorExibicao : null);
      const nome = get('nome') || (formatoSeis ? removerPrefixoProprietario(valorExibicao) : null);
      const parent = get('parent_id_erp') || null;
      const ativoStr = get('ativo').toLowerCase();
      const vincStr = get('vinculado_atualmente').toLowerCase();
      const contextoStr = get('contexto');

      const item: ItemListaV3 = {
        tipo_catalogo: tipoCatalogo as TipoCatalogoV3,
        id_erp: idErp,
        valor_exibicao: valorExibicao,
        codigo,
        nome: nome ?? (tipoCatalogo === 'PROPRIETARIO' ? derivarNomeProprietario(valorExibicao) : null),
        parent_id_erp: parent,
        ativo: ativoStr === '' ? true : ativoStr === 'true' || ativoStr === '1' || ativoStr.startsWith('ativ'),
        vinculado_atualmente: vincStr === 'true' || vincStr === '1',
        contexto: tipoCatalogo === 'PROPRIETARIO' ? derivarContexto(contextoStr, valorExibicao) : null,
      };
      itens.push(item);
    } catch (e) {
      warnings.push({
        codigo: 'LINHA_LISTA_INVALIDA_IGNORADA',
        mensagem: `_LISTAS linha ${n}: exceção "${e instanceof Error ? e.message : String(e)}".`,
      });
    }
  }

  const por_tipo = {
    FROTA: [], SUBCATEGORIA: [], LINHA_OPERACIONAL: [], CENTRO_CUSTO: [],
    FABRICANTE: [], DEPARTAMENTO: [], PROPRIETARIO: [],
  } as Record<TipoCatalogoV3, ItemListaV3[]>;
  for (const it of itens) {
    if (por_tipo[it.tipo_catalogo]) por_tipo[it.tipo_catalogo].push(it);
  }
  return { itens, por_tipo };
}

// ─── Resolvers null-safe por catálogo ─────────────────────────────────────
interface IndicesListas {
  porTipoLabel: Map<string, ItemListaV3>;
  porTipoUpper: Map<string, ItemListaV3>;
  porTipoCodigo: Map<string, ItemListaV3>;
  proprietarioPorNomeNormalizado: Map<string, ItemListaV3[]>;
}

function indexarListas(listas: ListasReferenciaV3): IndicesListas {
  const porTipoLabel = new Map<string, ItemListaV3>();
  const porTipoUpper = new Map<string, ItemListaV3>();
  const porTipoCodigo = new Map<string, ItemListaV3>();
  const proprietarioPorNomeNormalizado = new Map<string, ItemListaV3[]>();
  for (const it of listas.itens) {
    const label = (it.valor_exibicao ?? '').trim();
    if (!label) continue;
    porTipoLabel.set(`${it.tipo_catalogo}::${label}`, it);
    porTipoUpper.set(`${it.tipo_catalogo}::${label.toUpperCase()}`, it);
    if (it.codigo) porTipoCodigo.set(`${it.tipo_catalogo}::${String(it.codigo).toUpperCase()}`, it);
    if (it.tipo_catalogo === 'PROPRIETARIO') {
      const nome = normalizarComparacao(removerPrefixoProprietario(label));
      if (nome) {
        const arr = proprietarioPorNomeNormalizado.get(nome) ?? [];
        arr.push(it);
        proprietarioPorNomeNormalizado.set(nome, arr);
      }
    }
  }
  return { porTipoLabel, porTipoUpper, porTipoCodigo, proprietarioPorNomeNormalizado };
}

interface ResolucaoResultado {
  item: ItemListaV3 | null;
  erro?: ErroLinhaSimplificadoV3;
}

function resolverPorLabel(
  tipo: TipoCatalogoV3,
  valor: unknown,
  idx: IndicesListas,
  codigoNaoResolvido: CodigoErroSimplificadoV3,
  campo: string,
  labelCampo: string,
): ResolucaoResultado {
  const label = txtNorm(valor);
  if (!label) return { item: null };
  const direto = idx.porTipoLabel.get(`${tipo}::${label}`);
  if (direto) return { item: direto };
  const caseIns = idx.porTipoUpper.get(`${tipo}::${label.toUpperCase()}`);
  if (caseIns) return { item: caseIns };
  const porCodigo = idx.porTipoCodigo.get(`${tipo}::${label.toUpperCase()}`);
  if (porCodigo) return { item: porCodigo };
  return {
    item: null,
    erro: {
      codigo: codigoNaoResolvido,
      campo,
      mensagem: `${labelCampo} "${label}" não encontrado na aba _LISTAS.`,
    },
  };
}

function resolverProprietario(valor: unknown, idx: IndicesListas): ResolucaoResultado {
  const label = txtNorm(valor);
  if (!label) return { item: null };
  const direto = idx.porTipoLabel.get(`PROPRIETARIO::${label}`);
  if (direto) return { item: direto };
  const porNome = idx.proprietarioPorNomeNormalizado.get(normalizarComparacao(label)) ?? [];
  if (porNome.length === 1) return { item: porNome[0] };
  if (porNome.length > 1) {
    return {
      item: null,
      erro: {
        codigo: 'PROPRIETARIO_AMBIGUO',
        campo: 'proprietario',
        mensagem: `Proprietário "${label}" é ambíguo. Use o valor completo do dropdown (EMPRESA | ... ou LOCADORA | ...).`,
      },
    };
  }
  return {
    item: null,
    erro: {
      codigo: 'PROPRIETARIO_NAO_RESOLVIDO',
      campo: 'proprietario',
      mensagem: `Proprietário "${label}" não encontrado na aba _LISTAS.`,
    },
  };
}

async function refsTabelasNoArquivo(buffer: ArrayBuffer): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const refs: string[] = [];
    const arquivos = Object.keys(zip.files).filter((p) => /^xl\/tables\/table\d+\.xml$/i.test(p));
    await Promise.all(arquivos.map(async (p) => {
      const xml = await zip.files[p].async('string');
      const m = xml.match(/\bref="([^"]+)"/i);
      if (m?.[1]) refs.push(m[1]);
    }));
    return refs;
  } catch {
    return [];
  }
}

// ─── Núcleo público ───────────────────────────────────────────────────────
export async function parseWorkbookV3Simplificado(
  buffer: ArrayBuffer,
): Promise<ParseWorkbookV3SimplificadoResult> {
  console.info('[IMPORTADOR V3S] PARSER SHEETJS BUILD 2026-07-20-01');
  const errosGlobais: ErroLinhaSimplificadoV3[] = [];
  const warningsGlobais: ErroLinhaSimplificadoV3[] = [];
  const listasVazias: ListasReferenciaV3 = {
    itens: [],
    por_tipo: {
      FROTA: [], SUBCATEGORIA: [], LINHA_OPERACIONAL: [], CENTRO_CUSTO: [],
      FABRICANTE: [], DEPARTAMENTO: [], PROPRIETARIO: [],
    },
  };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, {
      type: 'array',
      raw: true,
      cellDates: true,
      dense: false,
    });
  } catch (e) {
    errosGlobais.push({
      codigo: 'XLSX_CORROMPIDO',
      mensagem: `Falha ao abrir XLSX: ${e instanceof Error ? e.message : String(e)}`,
    });
    return vazio(errosGlobais, warningsGlobais, listasVazias);
  }

  // ── METADADOS ────────────────────────────────────────────────────────────
  const wsMeta = wb.Sheets[ABA_METADADOS_V3S];
  if (!wsMeta) {
    errosGlobais.push({
      codigo: 'ABA_METADADOS_AUSENTE',
      mensagem: `Aba ${ABA_METADADOS_V3S} ausente — o arquivo não é do layout simplificado.`,
    });
    return vazio(errosGlobais, warningsGlobais, listasVazias);
  }
  const meta: Record<string, string> = {};
  const metaRange = rangeDaPlanilha(wsMeta);
  for (let n = 2; n <= (metaRange?.e.r ?? 0) + 1; n += 1) {
    const k = txtNorm(valorCelula(wsMeta, n, 1));
    const v = txtNorm(valorCelula(wsMeta, n, 2));
    if (k) meta[k] = v;
  }

  const schema = meta.schema_version ?? '';
  const tipoArquivo = meta.tipo_arquivo ?? '';
  if (!schema) {
    errosGlobais.push({
      codigo: 'MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO',
      campo: 'schema_version',
      mensagem: 'METADADOS.schema_version ausente. Baixe o novo modelo simplificado.',
    });
    return vazio(errosGlobais, warningsGlobais, listasVazias, schema, tipoArquivo);
  }
  if (schema !== SCHEMA_VERSION_SIMPLIFICADO) {
    errosGlobais.push({
      codigo: 'SCHEMA_VERSION_INCOMPATIVEL',
      campo: 'schema_version',
      mensagem: `schema_version esperado "${SCHEMA_VERSION_SIMPLIFICADO}", recebido "${schema}". Baixe o novo modelo simplificado.`,
    });
    return vazio(errosGlobais, warningsGlobais, listasVazias, schema, tipoArquivo);
  }

  // ── _LISTAS ──────────────────────────────────────────────────────────────
  const wsListas = wb.Sheets[ABA_LISTAS_V3S];
  if (!wsListas) {
    errosGlobais.push({
      codigo: 'ABA_LISTAS_AUSENTE',
      mensagem: `Aba "${ABA_LISTAS_V3S}" ausente — o preview depende dos catálogos do XLSX.`,
    });
    return vazio(errosGlobais, warningsGlobais, listasVazias, schema, tipoArquivo);
  }
  const listas = lerAbaListas(wsListas, warningsGlobais);
  const idxListas = indexarListas(listas);

  // ── _CONTROLE ────────────────────────────────────────────────────────────
  const wsCtrl = wb.Sheets[ABA_CONTROLE_V3S];
  if (!wsCtrl) {
    errosGlobais.push({
      codigo: 'ABA_CONTROLE_AUSENTE',
      mensagem: `Aba "${ABA_CONTROLE_V3S}" ausente.`,
    });
    return vazio(errosGlobais, warningsGlobais, listas, schema, tipoArquivo);
  }
  const controle = new Map<string, {
    equipamento_id_erp: string;
    updated_at_origem: string;
    codigo_canonico: string;
    snapshot: Record<string, string | number | null>;
  }>();
  const controleIdentidades = new Map<string, string>();
  const ctrlRange = rangeDaPlanilha(wsCtrl);
  for (let num = 2; num <= (ctrlRange?.e.r ?? 0) + 1; num += 1) {
    try {
      const ref = txtNorm(valorCelula(wsCtrl, num, 1));
      if (!ref) continue;
      const eq = txtNorm(valorCelula(wsCtrl, num, 2));
      const upd = txtNorm(valorCelula(wsCtrl, num, 3));
      const codc = txtNorm(valorCelula(wsCtrl, num, 4));
      const snapRaw = celStr(valorCelula(wsCtrl, num, 5));
      let snap: Record<string, string | number | null> = {};
      try { snap = snapRaw ? JSON.parse(snapRaw) : {}; } catch { snap = {}; }
      controle.set(ref, { equipamento_id_erp: eq, updated_at_origem: upd, codigo_canonico: codc, snapshot: snap });
      if (codc) controleIdentidades.set(codc.toUpperCase(), ref);
    } catch {
      // linha de controle corrompida — ignora silenciosamente (não afeta preview de EQUIPAMENTOS).
    }
  }

  // ── EQUIPAMENTOS ─────────────────────────────────────────────────────────
  const wsEq = wb.Sheets[ABA_EQUIPAMENTOS_V3S];
  if (!wsEq) {
    errosGlobais.push({
      codigo: 'ABA_EQUIPAMENTOS_AUSENTE',
      mensagem: `Aba obrigatória "${ABA_EQUIPAMENTOS_V3S}" ausente.`,
    });
    return vazio(errosGlobais, warningsGlobais, listas, schema, tipoArquivo);
  }

  const header = extrairCabecalho(wsEq);
  const esperado = [...CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO];
  if (header.length < TOTAL_COLUNAS_FISICAS_SIMPLIFICADO) {
    errosGlobais.push({
      codigo: 'CABECALHO_INVALIDO',
      mensagem: `EQUIPAMENTOS deve ter ${TOTAL_COLUNAS_FISICAS_SIMPLIFICADO} colunas; encontrou ${header.length}.`,
    });
    return vazio(errosGlobais, warningsGlobais, listas, schema, tipoArquivo);
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
  if (errosGlobais.some((e) => (CODIGOS_FATAIS as readonly string[]).includes(e.codigo))) {
    return vazio(errosGlobais, warningsGlobais, listas, schema, tipoArquivo);
  }

  // ── Warning se a Excel Table não expandiu para todas as linhas ───────────
  try {
    const refs = await refsTabelasNoArquivo(buffer);
    const eqRange = rangeDaPlanilha(wsEq);
    const lastRowUsedRange = (eqRange?.e.r ?? 0) + 1;
    for (const ref of refs) {
      const m = ref.match(/:[A-Z]+(\d+)$/);
      if (m) {
        const fimTabela = Number(m[1]);
        if (fimTabela < lastRowUsedRange && lastRowUsedRange > 2) {
          warningsGlobais.push({
            codigo: 'TABELA_EXCEL_NAO_EXPANDIDA',
            mensagem: `Excel Table cobre até linha ${fimTabela}, mas há dados até ${lastRowUsedRange}. Parser SheetJS leu o used range completo assim mesmo.`,
          });
          break;
        }
      }
    }
  } catch { /* não crítico */ }

  // ── LINHAS ───────────────────────────────────────────────────────────────
  const linhas: LinhaClassificadaSimplificada[] = [];
  const contagemRefs = new Map<string, number>();
  const contagemIdentidades = new Map<string, number>();

  const eqRange = rangeDaPlanilha(wsEq);
  const lastRow = (eqRange?.e.r ?? 0) + 1;

  for (let n = 2; n <= lastRow; n += 1) {
    // Guarda try/catch por linha — nenhum TypeError sobe.
    const linha = processarLinha({
      n,
      wsEq,
      esperado,
      controle,
      controleIdentidades,
      idxListas,
      contagemRefs,
      contagemIdentidades,
    });
    if (linha) linhas.push(linha);
  }

  // Segunda passada: duplicidade de _controle_ref e identidade
  for (const l of linhas) {
    if (l.controle_ref && (contagemRefs.get(l.controle_ref) ?? 0) > 1) {
      adicionarErro(l, {
        codigo: 'CONTROLE_REF_DUPLICADO',
        campo: CHAVE_CONTROLE_REF,
        mensagem: `_controle_ref "${l.controle_ref}" aparece em ${contagemRefs.get(l.controle_ref)} linhas.`,
      });
    }
    if ((l.acao_inferida === 'INSERIR' || l.acao === 'INSERIR') && l.codigo_canonico
        && (contagemIdentidades.get(l.codigo_canonico) ?? 0) > 1) {
      adicionarErro(l, {
        codigo: 'IDENTIDADE_DUPLICADA',
        mensagem: `Identidade "${l.codigo_canonico}" aparece em ${contagemIdentidades.get(l.codigo_canonico)} linhas.`,
      });
    }
  }

  const linhasComErro = linhas.filter((l) => l.erros.length > 0).length;
  const totalInconsistencias = linhas.reduce((acc, l) => acc + l.erros.length, 0);

  const resumo = {
    total: linhas.length,
    inserir: linhas.filter((l) => l.acao === 'INSERIR').length,
    atualizar: linhas.filter((l) => l.acao === 'ATUALIZAR').length,
    sem_alteracao: linhas.filter((l) => l.acao === 'SEM_ALTERACAO').length,
    ignorada: linhas.filter((l) => l.acao === 'IGNORADA').length,
    erro: linhas.filter((l) => l.acao === 'ERRO').length,
    linhas_com_erro: linhasComErro,
    total_inconsistencias: totalInconsistencias,
  };

  return {
    schema_version: schema,
    tipo_arquivo: tipoArquivo,
    arquivo_sha256_logico: meta.arquivo_sha256_logico ?? null,
    linhas,
    listas,
    resumo,
    erros_globais: errosGlobais,
    warnings_globais: warningsGlobais,
  };
}

// ─── Processamento por linha (protegido por try/catch) ────────────────────
interface CtxLinha {
  n: number;
  wsEq: XLSX.WorkSheet;
  esperado: string[];
  controle: Map<string, {
    equipamento_id_erp: string;
    updated_at_origem: string;
    codigo_canonico: string;
    snapshot: Record<string, string | number | null>;
  }>;
  controleIdentidades: Map<string, string>;
  idxListas: IndicesListas;
  contagemRefs: Map<string, number>;
  contagemIdentidades: Map<string, number>;
}

function processarLinha(ctx: CtxLinha): LinhaClassificadaSimplificada | null {
  const { n, wsEq, esperado, controle, controleIdentidades,
          idxListas, contagemRefs, contagemIdentidades } = ctx;
  try {
    const raw: Record<string, unknown> = {};
    for (let c = 0; c < esperado.length; c += 1) {
      raw[esperado[c]] = valorCelula(wsEq, n, c + 1);
    }
    if (linhaCompletamenteVazia(raw)) return null;

    const refCru = txtNorm(raw[CHAVE_CONTROLE_REF]) || null;
    const canonicaAtual = normalizarLinhaCanonica(raw as LinhaCruaSimplificada);
    const codigoCanonico = calcularCodigoCanonico(raw as LinhaCruaSimplificada);

    if (refCru) contagemRefs.set(refCru, (contagemRefs.get(refCru) ?? 0) + 1);
    if (codigoCanonico) contagemIdentidades.set(codigoCanonico, (contagemIdentidades.get(codigoCanonico) ?? 0) + 1);

    const linha: LinhaClassificadaSimplificada = {
      linha_excel: n,
      acao: 'IGNORADA',
      acao_inferida: 'IGNORADA',
      controle_ref: refCru,
      codigo_canonico: codigoCanonico,
      campos_atualizar: [],
      atual_canonico: canonicaAtual,
      original_canonico: null,
      erros: [],
      raw,
      elegivel: false,
    };

    // ── Classificação estrutural ───────────────────────────────────────
    if (!refCru) {
      if (codigoCanonico && controleIdentidades.has(codigoCanonico.toUpperCase())) {
        linha.acao_inferida = 'INSERIR';
        adicionarErro(linha, {
          codigo: 'CONTROLE_REF_AUSENTE',
          campo: CHAVE_CONTROLE_REF,
          mensagem: `Identidade ${codigoCanonico} já existe em _CONTROLE — restaure o _controle_ref original.`,
        });
      } else {
        linha.acao = 'INSERIR';
        linha.acao_inferida = 'INSERIR';
      }
    } else {
      const ctrl = controle.get(refCru);
      if (!ctrl) {
        linha.acao_inferida = 'ATUALIZAR';
        adicionarErro(linha, {
          codigo: 'CONTROLE_REF_INVALIDO',
          campo: CHAVE_CONTROLE_REF,
          mensagem: `_controle_ref "${refCru}" não consta em _CONTROLE.`,
        });
      } else {
        linha.original_canonico = ctrl.snapshot;
        const diffs = diffCanonico(ctrl.snapshot, canonicaAtual);
        const protegidosAlterados = diffs.filter((d) => CAMPOS_PROTEGIDOS.has(d));
        if (protegidosAlterados.length > 0) {
          linha.acao_inferida = 'ATUALIZAR';
          for (const p of protegidosAlterados) {
            adicionarErro(linha, {
              codigo: 'CAMPO_PROTEGIDO_ALTERADO',
              campo: p,
              mensagem: `Campo "${p}" é protegido — não pode ser alterado por importação.`,
            });
          }
        } else if (diffs.length === 0) {
          linha.acao = 'SEM_ALTERACAO';
          linha.acao_inferida = 'SEM_ALTERACAO';
        } else {
          linha.acao = 'ATUALIZAR';
          linha.acao_inferida = 'ATUALIZAR';
          const tokens = new Set<string>();
          for (const d of diffs) {
            const t = CHAVE_CANONICA_PARA_TOKEN[d];
            if (t) tokens.add(t);
          }
          linha.campos_atualizar = [...tokens].sort();
        }
      }
    }

    // ── Validações operacionais (obrigatoriedade + lookup null-safe) ────
    // Só valida "obrigatório para INSERIR" quando a intenção é criar.
    const paraInserir = linha.acao_inferida === 'INSERIR';

    // FROTA / NUMERO
    const frotaLbl = upperNorm(raw['frota_codigo']);
    const numeroLbl = txtNorm(raw['numero_frota']);
    if (paraInserir) {
      if (!frotaLbl) {
        adicionarErro(linha, { codigo: 'FROTA_OBRIGATORIA', campo: 'frota_codigo', mensagem: 'frota_codigo obrigatório.' });
      } else {
        const rFrota = resolverPorLabel('FROTA', frotaLbl, idxListas,
          'FROTA_NAO_RESOLVIDA', 'frota_codigo', 'Frota');
        if (rFrota.erro) adicionarErro(linha, rFrota.erro);
      }
      if (!numeroLbl) {
        adicionarErro(linha, { codigo: 'NUMERO_FROTA_OBRIGATORIO', campo: 'numero_frota', mensagem: 'numero_frota obrigatório.' });
      }
    }

    // SUBCATEGORIA (obrigatória em INSERIR)
    const subLbl = txtNorm(raw['subcategoria']);
    if (paraInserir && !subLbl) {
      adicionarErro(linha, { codigo: 'SUBCATEGORIA_OBRIGATORIA', campo: 'subcategoria', mensagem: 'subcategoria obrigatória.' });
    } else if (subLbl) {
      const r = resolverPorLabel('SUBCATEGORIA', subLbl, idxListas,
        'SUBCATEGORIA_NAO_RESOLVIDA', 'subcategoria', 'Subcategoria');
      if (r.erro) adicionarErro(linha, r.erro);
    }

    // PROPRIETARIO (obrigatório em INSERIR)
    const propLbl = txtNorm(raw['proprietario']);
    if (paraInserir && !propLbl) {
      adicionarErro(linha, { codigo: 'PROPRIETARIO_OBRIGATORIO', campo: 'proprietario', mensagem: 'proprietário obrigatório.' });
    } else if (propLbl) {
      const r = resolverProprietario(propLbl, idxListas);
      if (r.item) raw['proprietario'] = r.item.valor_exibicao;
      if (r.erro) adicionarErro(linha, r.erro);
    }

    // CENTRO_CUSTO (obrigatório em INSERIR)
    const ccLbl = upperNorm(raw['centro_custo']);
    if (paraInserir && !ccLbl) {
      adicionarErro(linha, { codigo: 'CENTRO_CUSTO_OBRIGATORIO', campo: 'centro_custo', mensagem: 'centro de custo obrigatório.' });
    } else if (ccLbl) {
      const r = resolverPorLabel('CENTRO_CUSTO', ccLbl, idxListas,
        'CENTRO_CUSTO_NAO_RESOLVIDO', 'centro_custo', 'Centro de custo');
      if (r.erro) adicionarErro(linha, r.erro);
    }

    // FABRICANTE (opcional; se preenchido, deve resolver)
    const fabLbl = txtNorm(raw['fabricante']);
    if (fabLbl) {
      const r = resolverPorLabel('FABRICANTE', fabLbl, idxListas,
        'FABRICANTE_NAO_RESOLVIDO', 'fabricante', 'Fabricante');
      if (r.erro) adicionarErro(linha, r.erro);
    }

    // DEPARTAMENTO (opcional; se preenchido, deve resolver)
    const depLbl = txtNorm(raw['departamento']);
    if (depLbl) {
      const r = resolverPorLabel('DEPARTAMENTO', depLbl, idxListas,
        'DEPARTAMENTO_NAO_RESOLVIDO', 'departamento', 'Departamento');
      if (r.erro) adicionarErro(linha, r.erro);
    }

    // LINHA_OPERACIONAL (opcional; se preenchido, deve resolver)
    const loLbl = txtNorm(raw['linha_operacional']);
    if (loLbl) {
      const r = resolverPorLabel('LINHA_OPERACIONAL', loLbl, idxListas,
        'LINHA_OPERACIONAL_NAO_RESOLVIDA', 'linha_operacional', 'Linha operacional');
      if (r.erro) adicionarErro(linha, r.erro);
    }

    linha.elegivel = linha.erros.length === 0 && (linha.acao === 'INSERIR' || linha.acao === 'ATUALIZAR');
    return linha;
  } catch (e) {
    // Nunca deixa TypeError virar erro fatal — cai em ERRO_INTERNO_LINHA.
    const stack = e instanceof Error ? e.stack : undefined;
    // eslint-disable-next-line no-console
    console.error('[parseWorkbookV3Simplificado] ERRO_INTERNO_LINHA', {
      etapa: 'processarLinha',
      linha_excel: n,
      erro: e instanceof Error ? e.message : String(e),
      stack,
    });
    return {
      linha_excel: n,
      acao: 'ERRO',
      acao_inferida: 'IGNORADA',
      controle_ref: null,
      codigo_canonico: '',
      campos_atualizar: [],
      atual_canonico: {},
      original_canonico: null,
      erros: [{
        codigo: 'ERRO_INTERNO_LINHA',
        mensagem: `Não foi possível interpretar esta linha: ${e instanceof Error ? e.message : String(e)}`,
      }],
      raw: {},
      elegivel: false,
    };
  }
}

function adicionarErro(linha: LinhaClassificadaSimplificada, erro: ErroLinhaSimplificadoV3): void {
  linha.erros.push(erro);
  linha.acao = 'ERRO';
  linha.elegivel = false;
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

function vazio(
  erros: ErroLinhaSimplificadoV3[],
  warnings: ErroLinhaSimplificadoV3[],
  listas: ListasReferenciaV3,
  schema = '',
  tipoArquivo = '',
): ParseWorkbookV3SimplificadoResult {
  return {
    schema_version: schema,
    tipo_arquivo: tipoArquivo,
    arquivo_sha256_logico: null,
    linhas: [],
    listas,
    resumo: {
      total: 0, inserir: 0, atualizar: 0, sem_alteracao: 0, ignorada: 0, erro: 0,
      linhas_com_erro: 0, total_inconsistencias: 0,
    },
    erros_globais: erros,
    warnings_globais: warnings,
  };
}

// ─── Utilitário público (compat) ──────────────────────────────────────────
export function pareceLayoutCompleto41(cabecalho: readonly string[]): boolean {
  return (
    cabecalho.length >= 40 &&
    cabecalho[0] === 'acao' &&
    cabecalho.includes('equipamento_id_erp') &&
    cabecalho.includes('campos_atualizar')
  );
}

export function ehCodigoFatal(codigo: string): boolean {
  return (CODIGOS_FATAIS as readonly string[]).includes(codigo);
}
