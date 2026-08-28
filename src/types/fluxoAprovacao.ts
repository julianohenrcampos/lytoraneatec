export type TipoAprovador =
  // Resolvedores corporativos (motor novo)
  | "engenheiro_responsavel_cc"
  | "engenheiro_solicitante"
  | "aprovador_padrao_cc"
  | "usuario_especifico"
  | "permissao_rbac"
  // Legados (Diárias) — preservados
  | "gerente_adm"
  | "diretor_operacional"
  | "diretor_financeiro"
  | "diretor_diretoria";

export const TIPO_APROVADOR_LABELS: Record<TipoAprovador, string> = {
  engenheiro_responsavel_cc: "Engenheiro responsável do CC",
  engenheiro_solicitante: "Engenheiro da solicitação",
  aprovador_padrao_cc: "Aprovador padrão do CC",
  usuario_especifico: "Usuário específico",
  permissao_rbac: "Permissão/RBAC",
  gerente_adm: "Gerente ADM (legado)",
  diretor_operacional: "Diretor Operacional (legado)",
  diretor_financeiro: "Diretor Financeiro (legado)",
  diretor_diretoria: "Diretor da Diretoria (legado)",
};

export const TIPOS_APROVADOR_LEGADOS: TipoAprovador[] = [
  "gerente_adm",
  "diretor_operacional",
  "diretor_financeiro",
  "diretor_diretoria",
];

// ==================== PROCESSOS ====================

export type ProcessoTipo = "SOLICITACAO_EQUIPAMENTO" | "DESMOBILIZACAO" | "CEDENCIA";

export const PROCESSO_TIPO_LABELS: Record<ProcessoTipo, string> = {
  SOLICITACAO_EQUIPAMENTO: "Solicitação de Equipamento",
  DESMOBILIZACAO: "Desmobilização",
  CEDENCIA: "Cedência",
};

export interface FluxoAplicacao {
  id: string;
  fluxo_id: string;
  processo_tipo: ProcessoTipo;
  centro_custo_id: string | null;
  ativo: boolean;
  prioridade: number;
  created_at: string;
  updated_at: string;
}

export interface AplicacaoFormData {
  processo_tipo: ProcessoTipo | null;
  /** true = default do processo (todos os CCs sem fluxo específico) */
  todos_centros_custo: boolean;
  centro_custo_ids: string[];
}

export interface FluxoAprovacao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versao: number;
  created_at: string;
  updated_at: string;
  // computed
  etapas_count?: number;
  vinculacoes_count?: number;
  aplicacoes_count?: number;
  /** Fluxo ligado apenas por bd_fluxo_centro_custo (motor legado de Diárias) */
  legado_diarias?: boolean;
}

export interface FluxoEtapa {
  id: string;
  fluxo_id: string;
  ordem: number;
  nome_exibicao: string;
  nome_tecnico: string;
  tipo_aprovador: TipoAprovador;
  cargo_id: string | null;
  permission_id: string | null;
  usuario_especifico_id: string | null;
  obrigatorio: boolean;
  permite_multiplo: boolean;
  ativo: boolean;
  created_at: string;
}

export interface FluxoCentroCusto {
  id: string;
  centro_custo_id: string;
  fluxo_id: string;
  ativo: boolean;
  created_at: string;
  centro_custo?: {
    nome_centro_custo: string;
    codigo_centro_custo: string;
  };
}

export interface FluxoAprovacaoExec {
  id: string;
  solicitacao_id: string;
  processo_tipo: string;
  etapa_id: string | null;
  etapa_nome_snapshot: string | null;
  fluxo_versao: number | null;
  usuario_id: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  ordem: number | null;
  pode_aprovar: boolean;
  data_aprovacao: string | null;
  observacao: string | null;
  aprovador_resolvido_id: string | null;
  aprovador_origem: string | null;
  aprovador_nome_snapshot: string | null;
  permission_id_snapshot: string | null;
  fluxo_id_snapshot: string | null;
  contexto_snapshot: Record<string, unknown> | null;
  created_at: string;
}

// Form data types
export interface FluxoFormData {
  nome: string;
  descricao: string;
  ativo: boolean;
}

export interface EtapaFormData {
  id?: string;
  ordem: number;
  nome_exibicao: string;
  nome_tecnico: string;
  tipo_aprovador: TipoAprovador;
  cargo_id: string | null;
  permission_id: string | null;
  usuario_especifico_id: string | null;
  obrigatorio: boolean;
  permite_multiplo: boolean;
}

// ==================== STATUS (core corporativo) ====================

export interface AprovacaoCorporativaStatus {
  requer_aprovacao: boolean;
  status: "AGUARDANDO" | "APROVADO" | "REJEITADO" | "SEM_FLUXO_CONFIGURADO";
  fluxo?: { id: string | null; nome: string | null; versao: number | null };
  total_etapas?: number;
  etapas_concluidas?: number;
  etapa_atual?: {
    id: string;
    ordem: number;
    nome: string | null;
    status: string;
    aprovador_id: string | null;
    aprovador_nome: string | null;
    aprovador_origem: string | null;
  } | null;
}
