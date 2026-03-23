export type TipoAprovador =
  | "gerente_adm"
  | "diretor_operacional"
  | "diretor_financeiro"
  | "diretor_diretoria"
  | "usuario_especifico";

export const TIPO_APROVADOR_LABELS: Record<TipoAprovador, string> = {
  gerente_adm: "Gerente ADM",
  diretor_operacional: "Diretor Operacional",
  diretor_financeiro: "Diretor Financeiro",
  diretor_diretoria: "Diretor da Diretoria",
  usuario_especifico: "Usuário Específico",
};

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
}

export interface FluxoEtapa {
  id: string;
  fluxo_id: string;
  ordem: number;
  nome_exibicao: string;
  nome_tecnico: string;
  tipo_aprovador: TipoAprovador;
  cargo_id: string | null;
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
  etapa_id: string | null;
  etapa_nome_snapshot: string | null;
  fluxo_versao: number | null;
  usuario_id: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  ordem: number | null;
  pode_aprovar: boolean;
  data_aprovacao: string | null;
  observacao: string | null;
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
  obrigatorio: boolean;
  permite_multiplo: boolean;
}
