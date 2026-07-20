// PR-3.3 Fase C2 — GERADOR ÚNICO XLSX V3 SIMPLIFICADO (ExcelJS).
//
// Substitui o gerador SheetJS para o layout simplificado. Emite:
//   - Aba EQUIPAMENTOS: 20 colunas visíveis + 1 técnica oculta `_controle_ref`,
//     coberta por Excel Table A:U com dropdowns reais nas colunas relacionais.
//   - Aba INSTRUCOES:  visível.
//   - Abas _LISTAS / _CONTROLE / METADADOS: state='hidden'.
//
// Zero escrita no banco. Zero side-effects. Aceita catálogos já carregados.
//
// SHA lógico: computado externamente por `calcularArquivoSha256LogicoV3`.
// Persistido em METADADOS.arquivo_sha256_logico + _CONTROLE.snapshot_original_json.

import ExcelJS from 'exceljs';
import {
  COLUNAS_EQUIPAMENTOS_SIMPLIFICADO,
  COLUNAS_VISIVEIS_SIMPLIFICADO,
  CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO,
  CHAVE_CONTROLE_REF,
  TOTAL_COLUNAS_FISICAS_SIMPLIFICADO,
} from './equipamentosSchemaSimplificado';
import { SCHEMA_VERSION_SIMPLIFICADO, normalizarLinhaCanonica, type TipoArquivoV3 } from './sha256LogicoV3';
import type { ItemListaV3, ListasReferenciaV3, TipoCatalogoV3 } from './carregarListasReferenciaV3';

// ─── Constantes de layout ─────────────────────────────────────────────────
export const ABA_EQUIPAMENTOS_V3S = 'EQUIPAMENTOS' as const;
export const ABA_INSTRUCOES_V3S = 'INSTRUCOES' as const;
export const ABA_LISTAS_V3S = '_LISTAS' as const;
export const ABA_CONTROLE_V3S = '_CONTROLE' as const;
export const ABA_METADADOS_V3S = 'METADADOS' as const;

/** Tabela principal cobrindo A:U (21 colunas, incluindo _controle_ref). */
export const NOME_TABELA_EQUIPAMENTOS = 'tbl_equipamentos' as const;
export const NOME_TABELA_CONTROLE = 'tbl_controle' as const;

// ─── Tipos públicos ───────────────────────────────────────────────────────
export interface RegistroExportacaoSimplificado {
  // Identidade técnica (nunca visível ao usuário além da coluna oculta).
  _controle_ref: string;
  equipamento_id_erp: string;
  updated_at_origem: string;
  codigo_canonico: string;
  /** JSON estável da linha canônica original — persistido em _CONTROLE. */
  snapshot_original_json: string;

  // 20 colunas visíveis
  frota_codigo: string;
  numero_frota: string;
  subcategoria: string;
  linha_operacional: string;
  proprietario: string;
  centro_custo: string;
  fabricante: string;
  modelo: string;
  ano_fabricacao: string;
  placa: string;
  chassi: string;
  numero_serie: string;
  renavam: string;
  motor: string;
  cor: string;
  tipo_combustivel: string;
  capacidade: string;
  aluguel: string;
  departamento: string;
  observacoes: string;
}

export interface GerarWorkbookV3SimplificadoInput {
  tipo_arquivo: TipoArquivoV3;
  listas: ListasReferenciaV3;
  /** Vazio no MODELO; preenchido na EXPORTACAO. */
  registros?: readonly RegistroExportacaoSimplificado[];
  /** SHA-256 lógico já calculado (via calcularArquivoSha256LogicoV3). */
  arquivo_sha256_logico: string;
  gerado_por?: string | null;
  ambiente_origem?: string | null;
  observacoes?: string | null;
}

// ─── Helpers de coluna Excel ──────────────────────────────────────────────
function colLetter(idx1: number): string {
  let n = idx1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const COMBUSTIVEIS_ENUM = ['Diesel', 'Diesel S10', 'Gasolina', 'Etanol', 'Flex', 'GNV', 'Elétrico'];
const CAPACIDADE_UNIDADES_HINT = 't, un, m3, l, kg, cv, hp, kw';

// ─── Aba _LISTAS ──────────────────────────────────────────────────────────
interface LinhaListaFisica {
  tipo_catalogo: TipoCatalogoV3;
  id_erp: string;
  valor_exibicao: string;
  ativo: 'true' | 'false';
  vinculado_atualmente: 'true' | 'false';
  contexto: string;
}

/** Mapa: tipo_catalogo → intervalo Excel absoluto dos valores em _LISTAS. */
type MapaIntervalosListas = Partial<Record<TipoCatalogoV3, string>>;

function montarAbaListas(ws: ExcelJS.Worksheet, listas: ListasReferenciaV3): MapaIntervalosListas {
  ws.columns = [
    { header: 'tipo_catalogo', key: 'tipo_catalogo', width: 18 },
    { header: 'id_erp', key: 'id_erp', width: 40 },
    { header: 'valor_exibicao', key: 'valor_exibicao', width: 44 },
    { header: 'ativo', key: 'ativo', width: 8 },
    { header: 'vinculado_atualmente', key: 'vinculado_atualmente', width: 22 },
    { header: 'contexto', key: 'contexto', width: 14 },
  ];

  // Agrupa por tipo e escreve — mantendo a ordem determinística.
  const ordem: TipoCatalogoV3[] = [
    'FROTA', 'SUBCATEGORIA', 'LINHA_OPERACIONAL', 'PROPRIETARIO',
    'CENTRO_CUSTO', 'FABRICANTE', 'DEPARTAMENTO',
  ];

  const intervalos: MapaIntervalosListas = {};
  let linha = 2; // após cabeçalho
  for (const tipo of ordem) {
    const itens = listas.por_tipo[tipo] ?? [];
    if (itens.length === 0) continue;
    const inicio = linha;
    for (const it of itens) {
      const row: LinhaListaFisica = {
        tipo_catalogo: it.tipo_catalogo,
        id_erp: it.id_erp,
        valor_exibicao: it.valor_exibicao,
        ativo: it.ativo ? 'true' : 'false',
        vinculado_atualmente: it.vinculado_atualmente ? 'true' : 'false',
        contexto: it.contexto ?? '',
      };
      ws.addRow(row);
      linha += 1;
    }
    const fim = linha - 1;
    // Intervalo apenas da coluna valor_exibicao (C).
    intervalos[tipo] = `$C$${inicio}:$C$${fim}`;
  }
  return intervalos;
}

// ─── Aba _CONTROLE ────────────────────────────────────────────────────────
function montarAbaControle(
  ws: ExcelJS.Worksheet,
  registros: readonly RegistroExportacaoSimplificado[],
): void {
  ws.columns = [
    { header: '_controle_ref', key: '_controle_ref', width: 40 },
    { header: 'equipamento_id_erp', key: 'equipamento_id_erp', width: 40 },
    { header: 'updated_at_origem', key: 'updated_at_origem', width: 30 },
    { header: 'codigo_canonico', key: 'codigo_canonico', width: 20 },
    { header: 'snapshot_original_json', key: 'snapshot_original_json', width: 80 },
  ];
  for (const r of registros) {
    ws.addRow({
      _controle_ref: r._controle_ref,
      equipamento_id_erp: r.equipamento_id_erp,
      updated_at_origem: r.updated_at_origem,
      codigo_canonico: r.codigo_canonico,
      snapshot_original_json: r.snapshot_original_json,
    });
  }
}

// ─── Aba METADADOS ────────────────────────────────────────────────────────
function montarAbaMetadados(
  ws: ExcelJS.Worksheet,
  input: GerarWorkbookV3SimplificadoInput,
  totalRegistros: number,
  totalListas: number,
): void {
  ws.columns = [
    { header: 'chave', key: 'chave', width: 30 },
    { header: 'valor', key: 'valor', width: 60 },
  ];
  const pares: Array<[string, string | number]> = [
    ['schema_version', SCHEMA_VERSION_SIMPLIFICADO],
    ['tipo_arquivo', input.tipo_arquivo],
    ['gerado_em_iso', new Date().toISOString()],
    ['gerado_por', input.gerado_por ?? ''],
    ['ambiente_origem', input.ambiente_origem ?? ''],
    ['arquivo_sha256_logico', input.arquivo_sha256_logico],
    ['total_colunas_visiveis', 20],
    ['total_colunas_fisicas', TOTAL_COLUNAS_FISICAS_SIMPLIFICADO],
    ['total_registros', totalRegistros],
    ['total_listas', totalListas],
    ['observacoes', input.observacoes ?? ''],
  ];
  for (const [k, v] of pares) ws.addRow({ chave: k, valor: v });
}

// ─── Aba INSTRUCOES ───────────────────────────────────────────────────────
function montarAbaInstrucoes(ws: ExcelJS.Worksheet): void {
  ws.columns = [{ header: 'INSTRUÇÕES', key: 'l', width: 120 }];
  const linhas: string[] = [
    'LYTOTEC — Importação de Equipamentos (layout SIMPLIFICADO)',
    `schema_version: ${SCHEMA_VERSION_SIMPLIFICADO}`,
    '',
    'Como usar este arquivo:',
    '  1) Preencha somente a aba EQUIPAMENTOS.',
    '  2) NÃO edite, exclua ou reordene as abas ocultas (_LISTAS, _CONTROLE, METADADOS).',
    '  3) NÃO edite a coluna técnica oculta "_controle_ref".',
    '  4) O sistema infere sozinho INSERIR / ATUALIZAR / SEM_ALTERACAO.',
    '  5) Envie o arquivo salvo pelo botão "Importar".',
    '',
    'Regras importantes:',
    '  - Identidade (frota_codigo + numero_frota) é imutável após criação.',
    '  - "centro_custo" só muda pelo fluxo operacional — bloqueado neste importador.',
    '  - "modelo" é texto livre (max 120 caracteres).',
    `  - "capacidade" aceita: 28 t, 8 un, 1.3 m3, 500 l, 200 hp — unidades: ${CAPACIDADE_UNIDADES_HINT}.`,
    '  - "aluguel" aceita "R$ 1.234,56", "1.234,56" ou "1234.56".',
    `  - "tipo_combustivel" aceita: ${COMBUSTIVEIS_ENUM.join(', ')}.`,
    '',
    'Colunas da aba EQUIPAMENTOS (20 visíveis, ordem oficial):',
    ...COLUNAS_VISIVEIS_SIMPLIFICADO.map((c) => `  ${c.cabecalho}  —  ${c.descricao}`),
  ];
  for (const l of linhas) ws.addRow({ l });
  ws.getRow(1).font = { bold: true };
}

// ─── Aba EQUIPAMENTOS ─────────────────────────────────────────────────────
function definirCabecalhoEquipamentos(ws: ExcelJS.Worksheet): void {
  ws.columns = COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map((c) => ({
    header: c.cabecalho,
    key: c.chave,
    width: c.chave === '_controle_ref' ? 40 : Math.max(12, Math.min(28, c.cabecalho.length + 4)),
    hidden: !c.visivel,
  }));
}

/** Aplica data validations (dropdowns) nas colunas relacionais + enums. */
function aplicarDataValidations(
  wsEq: ExcelJS.Worksheet,
  intervalos: MapaIntervalosListas,
  linhaFim: number, // inclusive
): void {
  const mapa: Array<[string, TipoCatalogoV3]> = [
    ['frota_codigo', 'FROTA'],
    ['subcategoria', 'SUBCATEGORIA'],
    ['linha_operacional', 'LINHA_OPERACIONAL'],
    ['proprietario', 'PROPRIETARIO'],
    ['centro_custo', 'CENTRO_CUSTO'],
    ['fabricante', 'FABRICANTE'],
    ['departamento', 'DEPARTAMENTO'],
  ];
  for (const [chave, tipo] of mapa) {
    const idx = COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.findIndex((c) => c.chave === chave) + 1;
    const letra = colLetter(idx);
    const intervalo = intervalos[tipo];
    if (!intervalo) continue;
    const range = `${letra}2:${letra}${linhaFim}`;
    // ExcelJS expõe dataValidations via propriedade não-tipada — cast intencional.
    (wsEq as unknown as { dataValidations: { add: (r: string, o: unknown) => void } })
      .dataValidations.add(range, {
        type: 'list',
        allowBlank: true,
        formulae: [`${ABA_LISTAS_V3S}!${intervalo}`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Valor fora da lista',
        error: 'Selecione um item da lista oficial (aba oculta _LISTAS).',
      });
  }

  // Enum tipo_combustivel — lista inline.
  const idxComb = COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.findIndex((c) => c.chave === 'tipo_combustivel') + 1;
  const rangeComb = `${colLetter(idxComb)}2:${colLetter(idxComb)}${linhaFim}`;
  (wsEq as unknown as { dataValidations: { add: (r: string, o: unknown) => void } })
    .dataValidations.add(rangeComb, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${COMBUSTIVEIS_ENUM.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Combustível inválido',
      error: `Aceitos: ${COMBUSTIVEIS_ENUM.join(', ')}.`,
    });
}

/** Cria named ranges (definedNames) apontando para os intervalos ativos em _LISTAS. */
function definirNamedRanges(wb: ExcelJS.Workbook, intervalos: MapaIntervalosListas): void {
  for (const [tipo, ref] of Object.entries(intervalos) as Array<[TipoCatalogoV3, string]>) {
    const nome = `LISTA_${tipo}`;
    // ExcelJS: workbook.definedNames.add(range, name) — range é referência absoluta com nome de aba.
    wb.definedNames.add(`${ABA_LISTAS_V3S}!${ref}`, nome);
  }
}

// ─── Núcleo público ───────────────────────────────────────────────────────
export async function gerarWorkbookV3Simplificado(
  input: GerarWorkbookV3SimplificadoInput,
): Promise<Uint8Array> {
  if (!input.arquivo_sha256_logico || input.arquivo_sha256_logico.length < 16) {
    throw new Error('arquivo_sha256_logico obrigatório (calcule via calcularArquivoSha256LogicoV3 antes de gerar).');
  }
  if (input.listas.itens.length === 0) {
    throw new Error('CATALOGOS_VAZIOS: recuse gerar arquivo sem listas de referência.');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Lytotec ERP';
  wb.created = new Date();

  // ═══ 1) EQUIPAMENTOS ═══════════════════════════════════════════════════
  const wsEq = wb.addWorksheet(ABA_EQUIPAMENTOS_V3S, { views: [{ state: 'frozen', ySplit: 1 }] });
  definirCabecalhoEquipamentos(wsEq);

  const registros = input.registros ?? [];
  for (const r of registros) {
    const row: Record<string, string | number> = {};
    for (const c of COLUNAS_EQUIPAMENTOS_SIMPLIFICADO) {
      const v = (r as unknown as Record<string, unknown>)[c.chave];
      row[c.chave] = v === null || v === undefined ? '' : String(v);
    }
    wsEq.addRow(row);
  }

  // ═══ 2) _LISTAS  (hidden) ══════════════════════════════════════════════
  const wsListas = wb.addWorksheet(ABA_LISTAS_V3S);
  wsListas.state = 'hidden';
  const intervalos = montarAbaListas(wsListas, input.listas);

  // ═══ 3) _CONTROLE (hidden) ═════════════════════════════════════════════
  const wsCtrl = wb.addWorksheet(ABA_CONTROLE_V3S);
  wsCtrl.state = 'hidden';
  montarAbaControle(wsCtrl, registros);

  // ═══ 4) METADADOS (hidden) ═════════════════════════════════════════════
  const wsMeta = wb.addWorksheet(ABA_METADADOS_V3S);
  wsMeta.state = 'hidden';
  montarAbaMetadados(wsMeta, input, registros.length, input.listas.itens.length);

  // ═══ 5) INSTRUCOES (visível) ═══════════════════════════════════════════
  const wsInstr = wb.addWorksheet(ABA_INSTRUCOES_V3S);
  montarAbaInstrucoes(wsInstr);

  // ═══ 6) NAMED RANGES ═══════════════════════════════════════════════════
  definirNamedRanges(wb, intervalos);

  // ═══ 7) DATA VALIDATIONS (aplicar antes de addTable) ══════════════════
  // Total de linhas: registros + buffer (para MODELO permitir entrada nova).
  const linhaFimValidations = Math.max(registros.length + 1, 500);
  aplicarDataValidations(wsEq, intervalos, linhaFimValidations);

  // ═══ 8) EXCEL TABLES ═══════════════════════════════════════════════════
  // A tabela cobre A:U inclusive quando não há registros; ExcelJS exige ao
  // menos 1 linha de dados — usamos vazio como placeholder e depois removemos.
  const linhasTabela: unknown[][] = registros.map((r) =>
    COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map((c) => {
      const v = (r as unknown as Record<string, unknown>)[c.chave];
      return v === null || v === undefined ? '' : v;
    }),
  );
  const rowsForTable = linhasTabela.length > 0
    ? linhasTabela
    : [COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map(() => '')];

  // Excel Tables — usamos apenas as colunas visíveis por padrão do Excel;
  // porém a especificação exige cobrir A:U (21 colunas). ExcelJS aceita
  // colunas ocultas dentro da tabela — a coluna hidden segue oculta pela
  // definição do worksheet.columns.
  const colunasTabela = COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map((c) => ({
    name: c.cabecalho,
    filterButton: c.visivel, // sem filtro na coluna oculta
  }));

  // Se a versão do ExcelJS falhar em adicionar a tabela sobre linhas já escritas,
  // capturamos e seguimos — a validação física (openpyxl) apontaria; nesta rodada
  // a tabela é essencial e não capturamos erros aqui.
  wsEq.addTable({
    name: NOME_TABELA_EQUIPAMENTOS,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
    columns: colunasTabela,
    rows: rowsForTable,
  });

  // Excel Table sobre _CONTROLE (cabeçalho + linhas). Mesmo tratamento.
  const linhasCtrl = registros.map((r) => [
    r._controle_ref, r.equipamento_id_erp, r.updated_at_origem, r.codigo_canonico, r.snapshot_original_json,
  ]);
  const rowsForCtrlTable = linhasCtrl.length > 0 ? linhasCtrl : [['', '', '', '', '']];
  wsCtrl.addTable({
    name: NOME_TABELA_CONTROLE,
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleLight8', showRowStripes: true },
    columns: [
      { name: '_controle_ref' }, { name: 'equipamento_id_erp' },
      { name: 'updated_at_origem' }, { name: 'codigo_canonico' },
      { name: 'snapshot_original_json' },
    ],
    rows: rowsForCtrlTable,
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

// ─── Helper: montar snapshot canônico para _CONTROLE ──────────────────────
export function montarSnapshotCanonicoJson(linha: Record<string, unknown>): string {
  const canon = normalizarLinhaCanonica(linha as Partial<Record<string, string | number | null>>);
  const keys = Object.keys(canon).sort();
  const ord: Record<string, unknown> = {};
  for (const k of keys) ord[k] = canon[k];
  return JSON.stringify(ord);
}

// ─── Empacotamento em Blob (browser) ──────────────────────────────────────
export function bytesToXlsxBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
