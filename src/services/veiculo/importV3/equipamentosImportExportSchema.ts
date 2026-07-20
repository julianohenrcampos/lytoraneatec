// PR-1.1 V3 — Matriz autoritativa de colunas da aba EQUIPAMENTOS.
// Fonte única para: Baixar Modelo, Exportar, Parser, Zod e validações.
// NENHUMA escrita no banco depende deste arquivo — é apenas contrato de arquivo.

import type { CampoSomenteLeitura } from './constants';

export type ColunaGrupo =
  | 'CONTROLE'
  | 'IDENTIDADE'
  | 'CLASSIFICACAO'
  | 'PROPRIETARIO'
  | 'ALOCACAO'
  | 'TECNICO'
  | 'SOMENTE_LEITURA';

export type ColunaTipo = 'texto' | 'numero' | 'inteiro' | 'iso_datetime' | 'enum' | 'csv';

export interface ColunaSpec {
  chave: string;
  cabecalho: string;
  grupo: ColunaGrupo;
  tipo: ColunaTipo;
  somente_leitura?: boolean;
  protegido_em_update?: boolean;
  /** Grupo atômico de VALIDAÇÃO no parser (identidade + parear id/nome no export). */
  grupo_atomico?: string;
  obrigatorio_inserir?: boolean;
  obrigatorio_atualizar?: boolean;
  obrigatorio_sem_alteracao?: boolean;
  descricao: string;
}

// ─── COLUNAS: 4 CONTROLE + 4 IDENTIDADE + 6 CLASSIFICACAO + 4 PROPRIETARIO +
//             2 ALOCACAO + 18 TECNICO + 3 SOMENTE_LEITURA = 41
export const COLUNAS_EQUIPAMENTOS: readonly ColunaSpec[] = [
  // ─── CONTROLE (4) ────────────────────────────────────────────────────────
  { chave: 'acao', cabecalho: 'acao', grupo: 'CONTROLE', tipo: 'enum',
    obrigatorio_inserir: true, obrigatorio_atualizar: true, obrigatorio_sem_alteracao: true,
    descricao: 'INSERIR | ATUALIZAR | SEM_ALTERACAO' },
  { chave: 'equipamento_id_erp', cabecalho: 'equipamento_id_erp', grupo: 'CONTROLE', tipo: 'texto',
    obrigatorio_atualizar: true, obrigatorio_sem_alteracao: true,
    descricao: 'UUID do ativo no ERP (vazio em INSERIR).' },
  { chave: 'updated_at_origem', cabecalho: 'updated_at_origem', grupo: 'CONTROLE', tipo: 'iso_datetime',
    obrigatorio_atualizar: true, obrigatorio_sem_alteracao: true,
    descricao: 'Gate de concorrência otimista para ATUALIZAR/SEM_ALTERACAO.' },
  { chave: 'campos_atualizar', cabecalho: 'campos_atualizar', grupo: 'CONTROLE', tipo: 'csv',
    obrigatorio_atualizar: true,
    descricao: 'Tokens lógicos separados por | (SUBCATEGORIA, FABRICANTE, MODELO, PROPRIETARIO, CAPACIDADE, ...).' },

  // ─── IDENTIDADE (4) — protegida em UPDATE ───────────────────────────────
  { chave: 'frota_codigo', cabecalho: 'frota_codigo', grupo: 'IDENTIDADE', tipo: 'texto',
    grupo_atomico: 'G_FROTA', obrigatorio_inserir: true, protegido_em_update: true,
    descricao: 'Prefixo alfabético da frota (2-4 letras). Identidade — imutável.' },
  { chave: 'numero_frota', cabecalho: 'numero_frota', grupo: 'IDENTIDADE', tipo: 'texto',
    grupo_atomico: 'G_FROTA', obrigatorio_inserir: true, protegido_em_update: true,
    descricao: 'Número da frota, LPAD(3) na exibição. Identidade — imutável.' },
  { chave: 'codigo_exibicao', cabecalho: 'codigo_exibicao', grupo: 'IDENTIDADE', tipo: 'texto',
    protegido_em_update: true,
    descricao: 'Código exibição (prefixo + numero LPAD3). Derivado — nunca gravável.' },
  { chave: 'codigo_canonico', cabecalho: 'codigo_canonico', grupo: 'IDENTIDADE', tipo: 'texto',
    obrigatorio_atualizar: true, obrigatorio_sem_alteracao: true, protegido_em_update: true,
    descricao: 'Código canônico (prefixo + número sem zeros à esquerda). Identidade.' },

  // ─── CLASSIFICAÇÃO (6) ──────────────────────────────────────────────────
  { chave: 'subcategoria_id_erp', cabecalho: 'subcategoria_id_erp', grupo: 'CLASSIFICACAO', tipo: 'texto',
    obrigatorio_inserir: true,
    descricao: 'UUID da subcategoria (bd_subcategorias_ativos.id). Token SUBCATEGORIA.' },
  { chave: 'subcategoria_nome', cabecalho: 'subcategoria_nome', grupo: 'CLASSIFICACAO', tipo: 'texto',
    descricao: 'Nome da subcategoria. Token SUBCATEGORIA.' },
  { chave: 'categoria_id_erp', cabecalho: 'categoria_id_erp', grupo: 'CLASSIFICACAO', tipo: 'texto',
    somente_leitura: true,
    descricao: 'UUID da categoria — derivada da subcategoria; conferência apenas.' },
  { chave: 'categoria_nome', cabecalho: 'categoria_nome', grupo: 'CLASSIFICACAO', tipo: 'texto',
    somente_leitura: true,
    descricao: 'Nome da categoria (derivado). Exportado só para conferência.' },
  { chave: 'linha_operacional_id_erp', cabecalho: 'linha_operacional_id_erp', grupo: 'CLASSIFICACAO', tipo: 'texto',
    descricao: 'UUID da linha operacional. Token LINHA_OPERACIONAL.' },
  { chave: 'linha_operacional_codigo', cabecalho: 'linha_operacional_codigo', grupo: 'CLASSIFICACAO', tipo: 'texto',
    descricao: 'Código da linha operacional. Token LINHA_OPERACIONAL.' },

  // ─── PROPRIETÁRIO (4) ───────────────────────────────────────────────────
  { chave: 'proprietario_regime', cabecalho: 'proprietario_regime', grupo: 'PROPRIETARIO', tipo: 'enum',
    obrigatorio_inserir: true,
    descricao: 'PROPRIO | LOCADO. Token PROPRIETARIO.' },
  { chave: 'proprietario_cadastro_tipo', cabecalho: 'proprietario_cadastro_tipo', grupo: 'PROPRIETARIO', tipo: 'enum',
    obrigatorio_inserir: true,
    descricao: 'EMPRESA | LOCADORA. Token PROPRIETARIO.' },
  { chave: 'proprietario_id_erp', cabecalho: 'proprietario_id_erp', grupo: 'PROPRIETARIO', tipo: 'texto',
    obrigatorio_inserir: true,
    descricao: 'UUID em bd_empresas ou bd_empresas_locadoras. Token PROPRIETARIO.' },
  { chave: 'proprietario_nome', cabecalho: 'proprietario_nome', grupo: 'PROPRIETARIO', tipo: 'texto',
    descricao: 'Nome do proprietário (conferência). Token PROPRIETARIO.' },

  // ─── ALOCAÇÃO (2) — protegida em UPDATE ─────────────────────────────────
  { chave: 'centro_custo_codigo', cabecalho: 'centro_custo_codigo', grupo: 'ALOCACAO', tipo: 'texto',
    obrigatorio_inserir: true, protegido_em_update: true,
    descricao: 'Alocação inicial (INSERIR). Protegido em ATUALIZAR (fluxo operacional).' },
  { chave: 'centro_custo_nome', cabecalho: 'centro_custo_nome', grupo: 'ALOCACAO', tipo: 'texto',
    protegido_em_update: true,
    descricao: 'Nome do centro de custo. Protegido em ATUALIZAR.' },

  // ─── TÉCNICO (18) ───────────────────────────────────────────────────────
  { chave: 'fabricante_id_erp', cabecalho: 'fabricante_id_erp', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'UUID em bd_fabricantes. Token FABRICANTE.' },
  { chave: 'fabricante_nome', cabecalho: 'fabricante_nome', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'Nome do fabricante. Token FABRICANTE.' },
  { chave: 'modelo_id_erp', cabecalho: 'modelo_id_erp', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'UUID em bd_modelos. Token MODELO.' },
  { chave: 'modelo_nome', cabecalho: 'modelo_nome', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'Nome do modelo. Token MODELO.' },
  { chave: 'motor', cabecalho: 'motor', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'Texto livre do motor. Token MOTOR.' },
  { chave: 'ano_fabricacao', cabecalho: 'ano_fabricacao', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'Ano de fabricação. Token ANO_FABRICACAO.' },
  { chave: 'placa', cabecalho: 'placa', grupo: 'TECNICO', tipo: 'texto', descricao: 'Placa. Token PLACA.' },
  { chave: 'chassi', cabecalho: 'chassi', grupo: 'TECNICO', tipo: 'texto', descricao: 'Chassi. Token CHASSI.' },
  { chave: 'numero_serie', cabecalho: 'numero_serie', grupo: 'TECNICO', tipo: 'texto', descricao: 'Nº série. Token NUMERO_SERIE.' },
  { chave: 'renavam', cabecalho: 'renavam', grupo: 'TECNICO', tipo: 'texto', descricao: 'Renavam. Token RENAVAM.' },
  { chave: 'cor', cabecalho: 'cor', grupo: 'TECNICO', tipo: 'texto', descricao: 'Cor. Token COR.' },
  { chave: 'tipo_combustivel', cabecalho: 'tipo_combustivel', grupo: 'TECNICO', tipo: 'texto', descricao: 'Combustível. Token TIPO_COMBUSTIVEL.' },
  { chave: 'capacidade_valor', cabecalho: 'capacidade_valor', grupo: 'TECNICO', tipo: 'numero',
    descricao: 'Valor numérico da capacidade. Token CAPACIDADE.' },
  { chave: 'capacidade_unidade', cabecalho: 'capacidade_unidade', grupo: 'TECNICO', tipo: 'enum',
    descricao: 'Unidade controlada (ton, un, m3, l, kg, hp, cv). Token CAPACIDADE.' },
  { chave: 'aluguel', cabecalho: 'aluguel', grupo: 'TECNICO', tipo: 'numero',
    descricao: 'Aluguel mensal (numeric). Token ALUGUEL.' },
  { chave: 'departamento_id_erp', cabecalho: 'departamento_id_erp', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'UUID do departamento. Token DEPARTAMENTO.' },
  { chave: 'departamento_nome', cabecalho: 'departamento_nome', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'Nome do departamento. Token DEPARTAMENTO.' },
  { chave: 'observacoes', cabecalho: 'observacoes', grupo: 'TECNICO', tipo: 'texto',
    descricao: 'Observações. Token OBSERVACOES.' },

  // ─── SOMENTE LEITURA (3) ────────────────────────────────────────────────
  { chave: 'situacao_atual', cabecalho: 'situacao_atual', grupo: 'SOMENTE_LEITURA', tipo: 'texto',
    somente_leitura: true, descricao: 'Situação operacional atual. Nunca gravável.' },
  { chave: 'status_cadastro_atual', cabecalho: 'status_cadastro_atual', grupo: 'SOMENTE_LEITURA', tipo: 'texto',
    somente_leitura: true, descricao: 'Status de cadastro atual.' },
  { chave: 'status_disponibilidade_atual', cabecalho: 'status_disponibilidade_atual', grupo: 'SOMENTE_LEITURA', tipo: 'texto',
    somente_leitura: true, descricao: 'Status de disponibilidade atual.' },
] as const;

export const CHAVES_EQUIPAMENTOS = COLUNAS_EQUIPAMENTOS.map((c) => c.chave);
export const CABECALHOS_EQUIPAMENTOS = COLUNAS_EQUIPAMENTOS.map((c) => c.cabecalho);

/** Contrato imutável: exatamente 41 colunas na aba EQUIPAMENTOS. */
export const TOTAL_COLUNAS_EQUIPAMENTOS = 41 as const;

// ─── TOKENS LÓGICOS PARA campos_atualizar ───────────────────────────────────
// PR-1.1: usuário/Claude declara TOKENS (SUBCATEGORIA, MODELO, ...), NUNCA
// nomes físicos de colunas. Cada token resolve seu grupo interno.
export const TOKENS_CAMPOS_ATUALIZAR = [
  'SUBCATEGORIA',
  'LINHA_OPERACIONAL',
  'PROPRIETARIO',
  'FABRICANTE',
  'MODELO',
  'MOTOR',
  'ANO_FABRICACAO',
  'PLACA',
  'CHASSI',
  'NUMERO_SERIE',
  'RENAVAM',
  'COR',
  'TIPO_COMBUSTIVEL',
  'CAPACIDADE',
  'ALUGUEL',
  'DEPARTAMENTO',
  'OBSERVACOES',
] as const;
export type TokenCampoAtualizar = (typeof TOKENS_CAMPOS_ATUALIZAR)[number];

/** Mapa token → chaves físicas atualizadas em conjunto. Categoria é derivada e
 *  NUNCA aparece aqui: SUBCATEGORIA atualiza categoria_ativo_id atomicamente no backend. */
export const TOKEN_TO_CHAVES: Record<TokenCampoAtualizar, readonly string[]> = {
  SUBCATEGORIA: ['subcategoria_id_erp', 'subcategoria_nome'],
  LINHA_OPERACIONAL: ['linha_operacional_id_erp', 'linha_operacional_codigo'],
  PROPRIETARIO: ['proprietario_regime', 'proprietario_cadastro_tipo', 'proprietario_id_erp', 'proprietario_nome'],
  FABRICANTE: ['fabricante_id_erp', 'fabricante_nome'],
  MODELO: ['modelo_id_erp', 'modelo_nome'],
  MOTOR: ['motor'],
  ANO_FABRICACAO: ['ano_fabricacao'],
  PLACA: ['placa'],
  CHASSI: ['chassi'],
  NUMERO_SERIE: ['numero_serie'],
  RENAVAM: ['renavam'],
  COR: ['cor'],
  TIPO_COMBUSTIVEL: ['tipo_combustivel'],
  CAPACIDADE: ['capacidade_valor', 'capacidade_unidade'],
  ALUGUEL: ['aluguel'],
  DEPARTAMENTO: ['departamento_id_erp', 'departamento_nome'],
  OBSERVACOES: ['observacoes'],
};

export interface ParseTokensResult {
  tokens: TokenCampoAtualizar[];
  chavesFisicas: string[];
  erro: string | null;
}

/** Normaliza campos_atualizar: trim, uppercase, split por |, dedup, valida allowlist. */
export function parseCamposAtualizar(csv: string): ParseTokensResult {
  const allow = new Set<string>(TOKENS_CAMPOS_ATUALIZAR);
  const raw = String(csv ?? '').split('|').map((s) => s.trim());
  if (raw.some((s) => s === '')) {
    return { tokens: [], chavesFisicas: [], erro: 'token vazio em campos_atualizar' };
  }
  const upper = raw.map((s) => s.toUpperCase());
  const dedup = Array.from(new Set(upper));
  if (dedup.length === 0) return { tokens: [], chavesFisicas: [], erro: 'campos_atualizar vazio' };
  for (const t of dedup) {
    if (!allow.has(t)) {
      return { tokens: [], chavesFisicas: [], erro: `token "${t}" fora da allowlist (use um de: ${TOKENS_CAMPOS_ATUALIZAR.join(', ')})` };
    }
  }
  const tokens = dedup as TokenCampoAtualizar[];
  const chaves: string[] = [];
  for (const t of tokens) for (const k of TOKEN_TO_CHAVES[t]) chaves.push(k);
  return { tokens, chavesFisicas: chaves, erro: null };
}

/** Grupos atômicos SOMENTE de identidade/export (não usados em UPDATE).
 *  G_FROTA aqui apenas para validar par (frota_codigo + numero_frota) em INSERIR. */
export const GRUPOS_ATOMICOS_IDENTIDADE: Record<string, string[]> = {
  G_FROTA: ['frota_codigo', 'numero_frota'],
};

/** Grupos atômicos aceitos em campos_atualizar (referência documental).
 *  A validação real é feita via TOKEN_TO_CHAVES; este mapa nunca inclui G_FROTA. */
export const GRUPOS_ATOMICOS_UPDATE: Record<string, string[]> = {
  G_SUBCATEGORIA: [...TOKEN_TO_CHAVES.SUBCATEGORIA],
  G_LINHA_OPERACIONAL: [...TOKEN_TO_CHAVES.LINHA_OPERACIONAL],
  G_PROPRIETARIO: [...TOKEN_TO_CHAVES.PROPRIETARIO],
  G_FABRICANTE: [...TOKEN_TO_CHAVES.FABRICANTE],
  G_MODELO: [...TOKEN_TO_CHAVES.MODELO],
  G_CAPACIDADE: [...TOKEN_TO_CHAVES.CAPACIDADE],
  G_DEPARTAMENTO: [...TOKEN_TO_CHAVES.DEPARTAMENTO],
};

/** @deprecated use GRUPOS_ATOMICOS_UPDATE + GRUPOS_ATOMICOS_IDENTIDADE.
 *  Mantido para consumidores externos; agrupamento composto. */
export const GRUPOS_ATOMICOS: Record<string, string[]> = {
  ...GRUPOS_ATOMICOS_IDENTIDADE,
  ...GRUPOS_ATOMICOS_UPDATE,
};

/** @deprecated Use TOKENS_CAMPOS_ATUALIZAR. Mantido para logs/UI legada.
 *  Lista de chaves físicas resolvidas por qualquer token da allowlist. */
export const CAMPOS_ATUALIZAVEIS: readonly string[] = Array.from(
  new Set(TOKENS_CAMPOS_ATUALIZAR.flatMap((t) => TOKEN_TO_CHAVES[t])),
);

export const CAMPOS_SOMENTE_LEITURA_ARQUIVO: CampoSomenteLeitura[] = [
  'situacao_atual', 'status_cadastro_atual', 'status_disponibilidade_atual',
];

// ─── Aba LISTAS ─────────────────────────────────────────────────────────────
export const COLUNAS_LISTAS = [
  'tipo_catalogo',
  'id_erp',
  'codigo',
  'nome',
  'tipo_destino',
  'parent_id_erp',
  'parent_codigo',
  'parent_nome',
  'ativo',
  'contexto',
] as const;

// ─── Aba METADADOS ──────────────────────────────────────────────────────────
export const CHAVES_METADADOS = [
  'schema_version',
  'tipo_arquivo',
  'gerado_em_iso',
  'gerado_por',
  'ambiente_origem',
  'projeto_supabase_ref',
  'arquivo_referencia_nome',
  'arquivo_referencia_sha256',
  'total_registros',
  'filtros_aplicados',
  'total_listas',
  'observacoes',
] as const;
export type ChaveMetadado = (typeof CHAVES_METADADOS)[number];
