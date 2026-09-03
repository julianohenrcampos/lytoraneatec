// PR-3.3 Fase C — Contrato FINAL SIMPLIFICADO da aba EQUIPAMENTOS.
// 20 colunas visíveis ao usuário + 1 coluna técnica oculta (`_controle_ref`).
// Nenhuma coluna de controle interno do ERP aparece ao usuário (nada de acao,
// equipamento_id_erp, updated_at_origem, campos_atualizar, codigo_canonico,
// categoria_nome, proprietario_regime, *_id_erp, situacao, status, auditoria).
// A inferência de INSERIR/ATUALIZAR/SEM_ALTERACAO é feita pelo parser via
// comparação canônica com o snapshot preservado em `_CONTROLE.snapshot_original_json`.

export type ColunaSimplificadaGrupo =
  | 'IDENTIDADE'
  | 'CLASSIFICACAO'
  | 'PROPRIETARIO'
  | 'ALOCACAO'
  | 'TECNICO'
  | 'CONTROLE_TECNICO';

export interface ColunaSimplificadaSpec {
  /** Chave física do registro hidratado do exportador (não do banco). */
  chave: string;
  /** Cabeçalho exibido na aba EQUIPAMENTOS (ou "_controle_ref" para a oculta). */
  cabecalho: string;
  grupo: ColunaSimplificadaGrupo;
  /** Coluna VISÍVEL ao usuário? Falsy = oculta (workbook column dimension hidden=true). */
  visivel: boolean;
  /** Referência a catálogo em _LISTAS (para data validation). */
  lista?:
    | 'FROTA'
    | 'SUBCATEGORIA'
    | 'LINHA_OPERACIONAL'
    | 'PROPRIETARIO'
    | 'CENTRO_CUSTO'
    | 'FABRICANTE'
    | 'DEPARTAMENTO';
  descricao: string;
}

// ─── 20 COLUNAS VISÍVEIS ─────────────────────────────────────────────────
//   6 IDENTIDADE/CLASSIFICACAO/ALOCACAO + 3 PROPRIETARIO/FABRICANTE/MODELO
//   + 8 TÉCNICO + 3 (aluguel, departamento, observacoes) = 20
// + 1 CONTROLE_TECNICO OCULTA (_controle_ref)   = 21 físicas
export const COLUNAS_EQUIPAMENTOS_SIMPLIFICADO: readonly ColunaSimplificadaSpec[] = [
  // ─── IDENTIDADE / CLASSIFICAÇÃO / ALOCAÇÃO ────────────────────────────
  { chave: 'frota_codigo',       cabecalho: 'frota_codigo',       grupo: 'IDENTIDADE',    visivel: true, lista: 'FROTA',
    descricao: 'Prefixo alfabético da frota (2-4 letras). Identidade — imutável.' },
  { chave: 'numero_frota',       cabecalho: 'numero_frota',       grupo: 'IDENTIDADE',    visivel: true,
    descricao: 'Número da frota. Identidade — imutável.' },
  { chave: 'subcategoria',       cabecalho: 'subcategoria',       grupo: 'CLASSIFICACAO', visivel: true, lista: 'SUBCATEGORIA',
    descricao: 'Subcategoria do ativo (bd_subcategorias_ativos).' },
  { chave: 'linha_operacional',  cabecalho: 'linha_operacional',  grupo: 'CLASSIFICACAO', visivel: true, lista: 'LINHA_OPERACIONAL',
    descricao: 'Código da linha operacional (opcional).' },
  { chave: 'proprietario',       cabecalho: 'proprietario',       grupo: 'PROPRIETARIO',  visivel: true, lista: 'PROPRIETARIO',
    descricao: 'Proprietário (contexto EMPRESA ou LOCADORA — via _LISTAS).' },
  { chave: 'centro_custo',       cabecalho: 'centro_custo',       grupo: 'ALOCACAO',      visivel: true, lista: 'CENTRO_CUSTO',
    descricao: 'Centro de custo atual (alocação — protegido em edições relacionais).' },

  // ─── FABRICANTE / MODELO / ANO ────────────────────────────────────────
  { chave: 'fabricante',         cabecalho: 'fabricante',         grupo: 'TECNICO',       visivel: true, lista: 'FABRICANTE',
    descricao: 'Fabricante (bd_fabricantes).' },
  { chave: 'modelo',             cabecalho: 'modelo',             grupo: 'TECNICO',       visivel: true,
    descricao: 'Modelo como texto livre (max 120).' },
  { chave: 'ano_fabricacao',     cabecalho: 'ano_fabricacao',     grupo: 'TECNICO',       visivel: true,
    descricao: 'Ano de fabricação (YYYY).' },

  // ─── PLACAS/DOCUMENTOS ────────────────────────────────────────────────
  { chave: 'placa',              cabecalho: 'placa',              grupo: 'TECNICO',       visivel: true,
    descricao: 'Placa (quando aplicável).' },
  { chave: 'chassi',             cabecalho: 'chassi',             grupo: 'TECNICO',       visivel: true,
    descricao: 'Chassi (quando aplicável).' },
  { chave: 'numero_serie',       cabecalho: 'numero_serie',       grupo: 'TECNICO',       visivel: true,
    descricao: 'Número de série (quando aplicável).' },
  { chave: 'renavam',            cabecalho: 'renavam',            grupo: 'TECNICO',       visivel: true,
    descricao: 'RENAVAM (quando aplicável).' },

  // ─── MOTOR / COR / COMBUSTÍVEL ────────────────────────────────────────
  { chave: 'motor',              cabecalho: 'motor',              grupo: 'TECNICO',       visivel: true,
    descricao: 'Especificação do motor.' },
  { chave: 'cor',                cabecalho: 'cor',                grupo: 'TECNICO',       visivel: true,
    descricao: 'Cor do ativo.' },
  { chave: 'tipo_combustivel',   cabecalho: 'tipo_combustivel',   grupo: 'TECNICO',       visivel: true,
    descricao: 'Diesel | Diesel S10 | Gasolina | Etanol | Flex | GNV | Elétrico.' },

  // ─── CAPACIDADE / ALUGUEL / DEPTO / OBS ───────────────────────────────
  { chave: 'capacidade',         cabecalho: 'capacidade',         grupo: 'TECNICO',       visivel: true,
    descricao: 'Ex: "28 t", "8 un", "1.3 m3". Unidades: t, un, m3, l, kg, cv, hp, kw.' },
  { chave: 'aluguel',            cabecalho: 'aluguel',            grupo: 'TECNICO',       visivel: true,
    descricao: 'Valor mensal (R$). Aceita "R$ 1.234,56", "1.234,56" ou "1234.56".' },
  { chave: 'departamento',       cabecalho: 'departamento',       grupo: 'TECNICO',       visivel: true, lista: 'DEPARTAMENTO',
    descricao: 'Departamento (bd_departamentos).' },
  { chave: 'observacoes',        cabecalho: 'observacoes',        grupo: 'TECNICO',       visivel: true,
    descricao: 'Observações livres.' },

  // ─── COLUNA TÉCNICA OCULTA (21ª) ──────────────────────────────────────
  { chave: '_controle_ref',      cabecalho: '_controle_ref',      grupo: 'CONTROLE_TECNICO', visivel: false,
    descricao: 'Referência interna estável (UUID). NÃO EDITAR. Coluna oculta.' },
] as const;

/** Apenas colunas visíveis ao usuário — exatamente 20. */
export const COLUNAS_VISIVEIS_SIMPLIFICADO = COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.filter((c) => c.visivel);

export const CABECALHOS_EQUIPAMENTOS_SIMPLIFICADO =
  COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map((c) => c.cabecalho);

export const CABECALHOS_VISIVEIS_SIMPLIFICADO =
  COLUNAS_VISIVEIS_SIMPLIFICADO.map((c) => c.cabecalho);

export const CHAVES_EQUIPAMENTOS_SIMPLIFICADO =
  COLUNAS_EQUIPAMENTOS_SIMPLIFICADO.map((c) => c.chave);

/** Contrato imutável do layout simplificado: 20 visíveis + 1 técnica oculta. */
export const TOTAL_COLUNAS_EQUIPAMENTOS_SIMPLIFICADO = 20 as const;
export const TOTAL_COLUNAS_FISICAS_SIMPLIFICADO = 21 as const;

/** Nome oficial da aba oculta e da coluna técnica de referência. */
export const CHAVE_CONTROLE_REF = '_controle_ref' as const;
