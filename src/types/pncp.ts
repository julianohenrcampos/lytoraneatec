export type StatusResultado = 'aguardando' | 'ganhou' | 'perdeu';

export interface PNCPContratacao {
  id: string;
  numero_controle_pncp: string;
  objeto: string;
  orgao_nome: string | null;
  orgao_cnpj: string | null;
  unidade_nome: string | null;
  municipio_nome: string | null;
  municipio_ibge: string | null;
  uf: string | null;
  valor_total_estimado: number | null;
  data_publicacao: string | null;
  data_inicio_propostas: string | null;
  data_fim_propostas: string | null;
  link_origem_pncp: string | null;
  modalidade_contratacao: string | null;
  prioridade: 'baixa' | 'media' | 'alta' | null;
  match_termos: string[] | null;
  participando: boolean;
  descartada: boolean;
  data_marcacao_participando: string | null;
  status_resultado: StatusResultado;
  perfil_busca_id: string | null;
  perfil_busca_nome: string | null;
  perfil_cor: string | null;
  created_at: string;
  updated_at: string;
}

export interface PNCPFilters {
  dataFim?: string;
  uf?: string;
  orgao?: string;
  categoriaValor?: string[];
  perfilBuscaId?: string;
  ocultarEncerradas?: boolean;
  ordenacao?: 'recentes' | 'prazo' | 'valor';
  sincronizadasHoje?: boolean;
}

export interface PNCPSyncLog {
  id: string;
  data_execucao: string;
  total_encontrados: number;
  total_inseridos: number;
  total_atualizados: number;
  total_duplicados: number;
  status: string;
  mensagem_erro: string | null;
  duracao_segundos: number | null;
  created_at: string;
}

export interface PNCPSyncResult {
  success: boolean;
  total_encontrados: number;
  total_inseridos: number;
  total_duplicados: number;
  duracao_segundos: number;
  error?: string;
}

export interface PNCPConfig {
  id: string;
  ativo: boolean;
  valor_minimo: number;
  valor_prioridade_alta: number;
  ufs_ativas: string[];
  municipios_ibge_interesse: string[];
  palavras_incluir: string[];
  palavras_excluir: string[];
  modalidades_ativas: number[];
  dias_busca_rapida: number;
  dias_busca_completa: number;
  prazo_minimo_dias: number;
  sync_automatico: boolean;
  sync_horario_1: string;
  sync_horario_2: string;
  sync_horario_3: string;
  created_at: string;
  updated_at: string;
}

// Nova interface para Perfis de Busca
export interface PNCPPerfilBusca {
  id: string;
  nome: string;
  descricao: string | null;
  palavras_primarias: string[];  // Específicas - basta 1 match
  palavras_secundarias: string[]; // Genéricas - precisa 2+ matches
  palavras_incluir: string[];     // Mantido para compatibilidade
  palavras_excluir: string[];
  valor_minimo: number | null;
  valor_maximo: number | null;
  ufs_ativas: string[];
  modalidades_ativas: number[];
  ativo: boolean;
  cor: string;
  created_at: string;
  updated_at: string;
}

// Cores predefinidas para perfis
export const CORES_PERFIL = [
  { valor: '#3B82F6', nome: 'Azul' },
  { valor: '#10B981', nome: 'Verde' },
  { valor: '#F59E0B', nome: 'Amarelo' },
  { valor: '#EF4444', nome: 'Vermelho' },
  { valor: '#8B5CF6', nome: 'Roxo' },
  { valor: '#EC4899', nome: 'Rosa' },
  { valor: '#06B6D4', nome: 'Ciano' },
  { valor: '#F97316', nome: 'Laranja' },
];

// Função utilitária para calcular dias restantes
export function calcularDiasRestantes(dataFim: string | null): number | null {
  if (!dataFim) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = new Date(dataFim);
  fim.setHours(0, 0, 0, 0);
  const diffTime = fim.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Lista de todas as UFs do Brasil
export const TODAS_UFS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

// Modalidades de contratação PNCP
export const MODALIDADES_PNCP = [
  { id: 4, nome: "Concorrência - Eletrônica (Obras)" },
  { id: 5, nome: "Concorrência - Presencial (Obras)" },
  { id: 6, nome: "Tomada de Preços - Eletrônica" },
  { id: 7, nome: "Tomada de Preços - Presencial" },
  { id: 8, nome: "Pregão - Eletrônico" },
  { id: 9, nome: "Pregão - Presencial" },
  { id: 12, nome: "Leilão - Eletrônico" },
  { id: 13, nome: "Leilão - Presencial" },
];
