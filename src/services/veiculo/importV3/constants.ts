// PR-1 V3 — Constantes autoritativas do contrato EQUIPAMENTOS_IMPORT_EXPORT_V3.
// Nenhuma escrita no banco depende deste arquivo.

export const SCHEMA_VERSION = 'EQUIPAMENTOS_IMPORT_EXPORT_V3' as const;
export const TIPO_ARQUIVO_MODELO = 'MODELO' as const;
export const TIPO_ARQUIVO_EXPORTACAO = 'EXPORTACAO' as const;

export const ABA_EQUIPAMENTOS = 'EQUIPAMENTOS' as const;
export const ABA_LISTAS = 'LISTAS' as const;
export const ABA_METADADOS = 'METADADOS' as const;
export const ABA_INSTRUCOES = 'INSTRUCOES' as const;

// Ações aceitas NO ARQUIVO. Statuses (BLOQUEADA/IGNORADA/ERRO/CONFLITO) são
// produzidos pelo parser e nunca fornecidos pelo usuário.
export const ACOES_ARQUIVO = ['INSERIR', 'ATUALIZAR', 'SEM_ALTERACAO'] as const;
export type AcaoArquivoV3 = (typeof ACOES_ARQUIVO)[number];

export const PROPRIETARIO_REGIMES = ['PROPRIO', 'LOCADO'] as const;
export type ProprietarioRegime = (typeof PROPRIETARIO_REGIMES)[number];

export const PROPRIETARIO_CADASTRO_TIPOS = ['EMPRESA', 'LOCADORA'] as const;
export type ProprietarioCadastroTipo = (typeof PROPRIETARIO_CADASTRO_TIPOS)[number];

// Unidades de capacidade controladas. "Unidade desconhecida não pode ser
// inventada" — o parser tolera vazio; qualquer valor fora desta lista vira
// alerta CAPACIDADE_UNIDADE_DESCONHECIDA sem escrita.
export const CAPACIDADE_UNIDADES = ['ton', 'un', 'm3', 'l', 'kg', 'hp', 'cv'] as const;
export type CapacidadeUnidade = (typeof CAPACIDADE_UNIDADES)[number];

// Tipos de linha na aba LISTAS.
export const LISTA_TIPOS = [
  'FROTA',
  'CENTRO_CUSTO',
  'CATEGORIA',
  'SUBCATEGORIA',
  'LINHA_OPERACIONAL',
  'FABRICANTE',
  'MODELO',
  'PROPRIETARIO',
  'DEPARTAMENTO',
  'ATIVO_EXISTENTE',
] as const;
export type ListaTipo = (typeof LISTA_TIPOS)[number];

// Status somente leitura na exportação (protegidos, nunca em campos_atualizar).
export const CAMPOS_SOMENTE_LEITURA = [
  'situacao_atual',
  'status_cadastro_atual',
  'status_disponibilidade_atual',
] as const;
export type CampoSomenteLeitura = (typeof CAMPOS_SOMENTE_LEITURA)[number];
