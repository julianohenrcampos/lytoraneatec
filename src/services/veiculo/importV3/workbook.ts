// PR-1 V3 — Utilitários de workbook (LISTAS, METADADOS, INSTRUCOES).
// Puro. Não fala com o banco.

import * as XLSX from 'xlsx';
import {
  SCHEMA_VERSION, TIPO_ARQUIVO_MODELO, TIPO_ARQUIVO_EXPORTACAO,
  ABA_EQUIPAMENTOS, ABA_LISTAS, ABA_METADADOS, ABA_INSTRUCOES,
  ACOES_ARQUIVO, PROPRIETARIO_REGIMES, PROPRIETARIO_CADASTRO_TIPOS, CAPACIDADE_UNIDADES,
} from './constants';
import {
  CABECALHOS_EQUIPAMENTOS, COLUNAS_EQUIPAMENTOS, COLUNAS_LISTAS, CHAVES_METADADOS,
  TOKENS_CAMPOS_ATUALIZAR, TOKEN_TO_CHAVES, GRUPOS_ATOMICOS_UPDATE,
} from './equipamentosImportExportSchema';
import {
  CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO, COLUNAS_EQUIPAMENTOS_SIMPLIFICADO,
} from './equipamentosSchemaSimplificado';

/**
 * PR-3.3 Fase B — Layout do arquivo XLSX.
 *   'simplificado' (default) → 20 colunas na aba EQUIPAMENTOS + abas internas ocultas.
 *   'completo'                → 41 colunas + todas as abas visíveis (legado V3).
 */
export type LayoutV3 = 'simplificado' | 'completo';
export const LAYOUT_PADRAO: LayoutV3 = 'simplificado';

export interface ListaLinha {
  tipo_catalogo: string;
  id_erp: string | null;
  codigo: string | null;
  nome: string | null;
  tipo_destino: string | null;
  parent_id_erp: string | null;
  parent_codigo: string | null;
  parent_nome: string | null;
  ativo: boolean;
  contexto: string | null;
}

export interface MetadadosV3 {
  tipo_arquivo: typeof TIPO_ARQUIVO_MODELO | typeof TIPO_ARQUIVO_EXPORTACAO;
  gerado_em_iso: string;
  gerado_por: string | null;
  ambiente_origem: string | null;
  projeto_supabase_ref: string | null;
  arquivo_referencia_nome: string | null;
  arquivo_referencia_sha256: string | null;
  total_registros: number;
  filtros_aplicados: string | null;
  total_listas: number;
  observacoes: string | null;
}

export function montarAbaEquipamentosVazia(layout: LayoutV3 = LAYOUT_PADRAO): XLSX.WorkSheet {
  const headers = layout === 'simplificado'
    ? CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO
    : CABECALHOS_EQUIPAMENTOS;
  return XLSX.utils.aoa_to_sheet([headers]);
}

export function montarAbaListas(linhas: ListaLinha[]): XLSX.WorkSheet {
  const header = [...COLUNAS_LISTAS];
  const rows = linhas.map((l) => COLUNAS_LISTAS.map((c) => {
    const v = (l as unknown as Record<string, unknown>)[c];
    if (c === 'ativo') return l.ativo ? 'true' : 'false';
    return v === null || v === undefined ? '' : String(v);
  }));
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

export function montarAbaMetadados(m: MetadadosV3): XLSX.WorkSheet {
  const registro: Record<string, string | number> = {
    schema_version: SCHEMA_VERSION,
    tipo_arquivo: m.tipo_arquivo,
    gerado_em_iso: m.gerado_em_iso,
    gerado_por: m.gerado_por ?? '',
    ambiente_origem: m.ambiente_origem ?? '',
    projeto_supabase_ref: m.projeto_supabase_ref ?? '',
    arquivo_referencia_nome: m.arquivo_referencia_nome ?? '',
    arquivo_referencia_sha256: m.arquivo_referencia_sha256 ?? '',
    total_registros: m.total_registros,
    filtros_aplicados: m.filtros_aplicados ?? '',
    total_listas: m.total_listas,
    observacoes: m.observacoes ?? '',
  };
  const rows: (string | number)[][] = [['chave', 'valor']];
  for (const k of CHAVES_METADADOS) rows.push([k, registro[k] ?? '']);
  return XLSX.utils.aoa_to_sheet(rows);
}

export function montarAbaInstrucoes(): XLSX.WorkSheet {
  const linhas: string[][] = [
    ['LYTOTEC — Importador V3 de Equipamentos'],
    [`schema_version: ${SCHEMA_VERSION}`],
    [''],
    ['Ações aceitas no arquivo:'],
    [`  ${ACOES_ARQUIVO.join(' | ')}`],
    ['  (BLOQUEADA/IGNORADA/ERRO/CONFLITO são apenas statuses do parser.)'],
    [''],
    ['Regras por ação:'],
    ['  INSERIR: exige frota_codigo, numero_frota, subcategoria_id_erp, proprietario_regime,'],
    ['           proprietario_cadastro_tipo, proprietario_id_erp, centro_custo_codigo.'],
    ['  ATUALIZAR: exige equipamento_id_erp, updated_at_origem, codigo_canonico, campos_atualizar'],
    ['             (TOKENS lógicos separados por | — allowlist estática).'],
    ['  SEM_ALTERACAO: exige equipamento_id_erp, updated_at_origem, codigo_canonico.'],
    [''],
    ['Campos PROTEGIDOS (nunca em campos_atualizar):'],
    ['  frota_codigo, numero_frota, codigo_canonico, codigo_exibicao (identidade).'],
    ['  centro_custo_codigo, centro_custo_nome (alocação — via fluxo operacional).'],
    ['  situacao_atual, status_cadastro_atual, status_disponibilidade_atual (somente leitura).'],
    ['  categoria_id_erp, categoria_nome (derivados de SUBCATEGORIA).'],
    [''],
    ['TOKENS aceitos em campos_atualizar (allowlist estática):'],
    [`  ${TOKENS_CAMPOS_ATUALIZAR.join(' | ')}`],
    ['  Separador: | (pipe). trim + uppercase + dedup. Token vazio ou fora da allowlist é rejeitado.'],
    ['  Exemplos válidos:'],
    ['    MODELO|ALUGUEL   |   FABRICANTE|MODELO   |   PROPRIETARIO   |   CAPACIDADE'],
    ['  Exemplos INVÁLIDOS (nomes físicos ou identidade):'],
    ['    modelo_id_erp, fabricante_nome, centro_custo_codigo, frota_codigo, situacao_atual'],
    [''],
    ['Chaves físicas resolvidas por cada token (referência):'],
    ...(Object.entries(TOKEN_TO_CHAVES) as Array<[string, readonly string[]]>).map(
      ([t, ks]) => [`  ${t}: ${ks.join(', ')}`]
    ),
    [''],
    ['Grupos atômicos aceitos em UPDATE (informativo — não inclui G_FROTA):'],
    ...Object.entries(GRUPOS_ATOMICOS_UPDATE).map(([g, ks]) => [`  ${g}: ${ks.join(', ')}`]),
    [''],
    ['Enums:'],
    [`  proprietario_regime: ${PROPRIETARIO_REGIMES.join(' | ')}`],
    [`  proprietario_cadastro_tipo: ${PROPRIETARIO_CADASTRO_TIPOS.join(' | ')}`],
    [`  capacidade_unidade: ${CAPACIDADE_UNIDADES.join(' | ')} (vazio permitido)`],
    [''],
    ['Fabricante/Modelo: nunca são criados automaticamente. FABRICANTE|MODELO valida em conjunto;'],
    ['  MODELO isolado exige que o modelo pertença ao fabricante atual (via LISTAS);'],
    ['  incompatibilidade retorna MODELO_INCOMPATIVEL_COM_FABRICANTE.'],
    ['Subcategoria: token SUBCATEGORIA exige subcategoria_id_erp + subcategoria_nome.'],
    ['  Categoria é derivada e permanece somente leitura no XLSX.'],
    ['Concorrência: updated_at_origem é gate obrigatório em ATUALIZAR e SEM_ALTERACAO.'],
    [''],
    ['Colunas da aba EQUIPAMENTOS (41 no total, ordem oficial):'],
    ...COLUNAS_EQUIPAMENTOS.map((c) => [`  ${c.cabecalho}  —  ${c.descricao}`]),
  ];
  return XLSX.utils.aoa_to_sheet(linhas);
}

/**
 * PR-3.3 Fase B — aba INSTRUCOES enxuta para o layout simplificado.
 * Sem exposição de tokens/grupos internos do ERP. Renderiza apenas o
 * contrato de 20 colunas efetivamente visível ao usuário.
 */
export function montarAbaInstrucoesSimplificada(): XLSX.WorkSheet {
  const linhas: string[][] = [
    ['LYTOTEC — Importação de Equipamentos (layout simplificado)'],
    [`schema_version: ${SCHEMA_VERSION}`],
    [''],
    ['Como usar este arquivo:'],
    ['  1) Preencha a aba EQUIPAMENTOS (20 colunas úteis, sem detalhes internos do ERP).'],
    ['  2) Coluna "acao" aceita: INSERIR | ATUALIZAR | SEM_ALTERACAO.'],
    ['     INSERIR:       linhas novas (deixe equipamento_id_erp / updated_at_origem em branco).'],
    ['     ATUALIZAR:     linhas já existentes (preencha equipamento_id_erp e updated_at_origem).'],
    ['     SEM_ALTERACAO: mantenha a linha exatamente como está (para conferência).'],
    ['  3) Envie o arquivo salvo no botão "Importar".'],
    [''],
    ['Regras importantes:'],
    ['  - Identidade (frota_codigo + numero_frota) é imutável após criação.'],
    ['  - "categoria_nome" e "codigo_exibicao" são exibidos apenas para conferência.'],
    ['  - "modelo" é texto livre (não use UUID).'],
    ['  - "capacidade_unidade" aceita: ton, un, m3, l, kg, hp, cv (ou vazio).'],
    ['  - "proprietario_regime" aceita: PROPRIO ou LOCADO.'],
    [''],
    ['Colunas da aba EQUIPAMENTOS (20 no total, ordem oficial):'],
    ...COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map((c) => [`  ${c.cabecalho}  —  ${c.descricao}`]),
  ];
  return XLSX.utils.aoa_to_sheet(linhas);
}

export interface MontarWorkbookInput {
  equipamentos: XLSX.WorkSheet;
  listas: ListaLinha[];
  metadados: MetadadosV3;
  /** PR-3.3 Fase B — default 'simplificado' (esconde LISTAS/METADADOS/INSTRUCOES). */
  layout?: LayoutV3;
}

/**
 * Marca uma aba já anexada ao workbook como oculta ao usuário final.
 * Usa o SheetJS Workbook.Sheets metadata (Hidden=1 = hidden; 2 = veryHidden).
 * A aba continua acessível programaticamente para debug/QA.
 */
function marcarAbasOcultas(wb: XLSX.WorkBook, nomes: readonly string[]): void {
  wb.Workbook = wb.Workbook ?? {};
  const meta = (wb.Workbook.Sheets = wb.Workbook.Sheets ?? []);
  wb.SheetNames.forEach((nome, i) => {
    meta[i] = meta[i] ?? { name: nome };
    meta[i].Hidden = nomes.includes(nome) ? 1 : 0;
  });
}

export function montarWorkbookV3(input: MontarWorkbookInput): XLSX.WorkBook {
  const layout: LayoutV3 = input.layout ?? LAYOUT_PADRAO;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, input.equipamentos, ABA_EQUIPAMENTOS);
  XLSX.utils.book_append_sheet(wb, montarAbaListas(input.listas), ABA_LISTAS);
  XLSX.utils.book_append_sheet(wb, montarAbaMetadados(input.metadados), ABA_METADADOS);
  const instrucoes = layout === 'simplificado'
    ? montarAbaInstrucoesSimplificada()
    : montarAbaInstrucoes();
  XLSX.utils.book_append_sheet(wb, instrucoes, ABA_INSTRUCOES);
  if (layout === 'simplificado') {
    marcarAbasOcultas(wb, [ABA_LISTAS, ABA_METADADOS, ABA_INSTRUCOES]);
  }
  return wb;
}

export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function workbookToBlob(wb: XLSX.WorkBook): Blob {
  return new Blob([workbookToArrayBuffer(wb)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
