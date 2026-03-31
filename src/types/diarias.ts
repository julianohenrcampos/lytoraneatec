// =====================================================
// TIPOS DO MÓDULO DIÁRIAS (Fim de Semana/Feriado)
// =====================================================

// Status types
export type StatusSolicitacao = 'rascunho' | 'enviada' | 'autorizada' | 'reprovada';
export type StatusConvocacao = 'rascunho' | 'enviada_aprovacao' | 'aprovada' | 'reprovada' | 'executando' | 'finalizada' | 'cancelada';
export type StatusPresenca = 'pendente' | 'presente' | 'ausente' | 'substituido';
export type StatusRelatorio = 'enviado_sede' | 'analisado' | 'divergencia' | 'aprovado_final' | 'pronto_lancamento';
export type StatusApontamento = 'aberto' | 'em_andamento' | 'finalizado' | 'cancelado';
export type EntidadeAprovacao = 'solicitacao' | 'convocacao' | 'relatorio';

// =====================================================
// ENTIDADES PRINCIPAIS
// =====================================================

export interface DiariaSolicitacao {
  id: string;
  numero_solicitacao: string;
  data_inicio: string;
  data_fim: string;
  centro_custo_id: string;
  justificativa: string;
  status: StatusSolicitacao;
  considera_fds_feriado: boolean;
  qtde_dias_uteis_estimado: number;
  qtde_fds_estimado: number;
  qtde_feriados_estimado: number;
  valor_estimado_total: number;
  convocados_pre?: FuncionarioPreConvocado[];
  responsavel_campo_id: string | null;
  engenheiro_solicitante_id: string | null;
  observacao_gerente: string | null;
  criado_por: string | null;
  autorizado_por: string | null;
  autorizado_em: string | null;
  status_fluxo?: string | null;
  etapa_atual?: number | null;
  tipo_envio?: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  bd_centros_custo?: {
    id: string;
    codigo_centro_custo: string;
    nome_centro_custo: string;
  };
  profiles?: {
    id: string;
    nome_completo: string;
    email: string;
  };
  responsavel_campo?: {
    id: string;
    nome_completo: string;
  };
  engenheiro_solicitante?: {
    id: string;
    nome_completo: string;
  };
}

export interface DiariaConvocacao {
  id: string;
  solicitacao_id: string;
  data: string;
  centro_custo_id: string;
  observacao: string | null;
  status: StatusConvocacao;
  criado_por: string | null;
  enviado_em: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  bd_diaria_solicitacoes?: DiariaSolicitacao;
  bd_centros_custo?: {
    id: string;
    codigo_centro_custo: string;
    nome_centro_custo: string;
  };
  profiles?: {
    id: string;
    nome_completo: string;
    email: string;
  };
  bd_diaria_convocados?: DiariaConvocado[];
}

export interface DiariaConvocado {
  id: string;
  convocacao_id: string;
  funcionario_id: string;
  funcao_id: string;
  valor_diaria_aplicada: number;
  hora_entrada: string | null;
  hora_saida: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  presenca_status: StatusPresenca;
  confirmado_por: string | null;
  confirmado_em: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  bd_funcionarios?: {
    id: string;
    nome_completo: string;
    cpf: string;
    imagem: string | null;
  };
  bd_funcoes?: {
    id: string;
    nome_funcao: string;
    valor_diaria: number | null;
    valor_diaria_exclusiva: number | null;
  };
  bd_diaria_convocacoes?: DiariaConvocacao;
}

export interface DiariaAprovacao {
  id: string;
  entidade: EntidadeAprovacao;
  entidade_id: string;
  acao: string;
  comentario: string | null;
  feito_por: string | null;
  feito_em: string;
  // Relations
  profiles?: {
    id: string;
    nome_completo: string;
    email: string;
  };
}

// =====================================================
// FORM DATA (para criar/editar)
// =====================================================

// Funcionário pré-convocado (antes da aprovação)
export interface FuncionarioPreConvocado {
  funcionario_id: string;
  funcao_id: string;
  valor_diaria: number;
  valor_diaria_exclusiva?: number; // Para FDS/feriados
  valor_refeicao?: number;
  nome_funcionario?: string;
  nome_funcao?: string;
  usar_diaria_exclusiva?: boolean; // Forçar diária exclusiva independente do dia
  cpf?: string; // Snapshot para resiliência a ID órfão
  matricula?: string; // Snapshot para resiliência a ID órfão
}

export interface SolicitacaoFormData {
  data_inicio: string;
  data_fim: string;
  centro_custo_id: string;
  justificativa: string;
  considera_fds_feriado: boolean;
  qtde_dias_uteis_estimado: number;
  qtde_fds_estimado: number;
  qtde_feriados_estimado: number;
  valor_estimado_total: number;
  convocados_pre?: FuncionarioPreConvocado[];
  responsavel_campo_id?: string;
  engenheiro_solicitante_id?: string;
}

export interface ConvocacaoFormData {
  solicitacao_id: string;
  data: string;
  centro_custo_id: string;
  observacao?: string;
}

export interface ConvocadoFormData {
  convocacao_id: string;
  funcionario_id: string;
  funcao_id: string;
  valor_diaria_aplicada: number;
  hora_entrada?: string;
  hora_saida?: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
}

export interface PresencaFormData {
  convocado_id: string;
  presenca_status: StatusPresenca;
  hora_entrada?: string;
  hora_saida?: string;
  intervalo_inicio?: string;
  intervalo_fim?: string;
}

export interface AprovacaoFormData {
  entidade: EntidadeAprovacao;
  entidade_id: string;
  acao: string;
  comentario?: string;
}

// =====================================================
// FILTROS
// =====================================================

export interface SolicitacaoFilters {
  periodo_inicio?: string;
  periodo_fim?: string;
  centro_custo_id?: string;
  status?: StatusSolicitacao;
  criado_por?: string;
}

export interface ConvocacaoFilters {
  data_inicio?: string;
  data_fim?: string;
  centro_custo_id?: string;
  status?: StatusConvocacao;
  criado_por?: string;
  solicitacao_id?: string;
}

export interface PresencaFilters {
  data?: string;
  centro_custo_id?: string;
  convocacao_id?: string;
  presenca_status?: StatusPresenca;
}

export interface RelatorioFilters {
  data_inicio?: string;
  data_fim?: string;
  centro_custo_id?: string;
  centro_custo_ids?: string[];
  funcionario_id?: string;
  solicitacao_id?: string;
  solicitacao_ids?: string[];
  empresa_id?: string;
  status_convocacao?: StatusConvocacao;
  presenca_status?: StatusPresenca;
  tipo_vinculo?: 'diarista' | 'remessa';
}

// =====================================================
// VIEWS (Relatórios)
// =====================================================

export interface RelatorioFolhaItem {
  presenca_id: string;
  solicitacao_id: string;
  numero_solicitacao: string;
  solicitacao_data_inicio: string;
  solicitacao_data_fim: string;
  data: string;
  centro_custo_id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  funcionario_id: string;
  nome_funcionario: string;
  empresa_id: string | null;
  empresa_funcionario: string | null;
  // Dados bancários do funcionário
  cpf_funcionario: string | null;
  banco_funcionario: string | null;
  agencia_funcionario: string | null;
  conta_funcionario: string | null;
  pix_funcionario: string | null;
  matricula_funcionario: string | null;
  funcao_id: string | null;
  nome_funcao: string | null;
  valor_diaria_aplicada: number;
  hora_entrada: string | null;
  hora_saida: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  presenca_status: string;
  confirmado_por: string | null;
  confirmado_em: string | null;
  recebe_refeicao: boolean | null;
  valor_refeicao_aplicado: number | null;
  tipo_diaria: string | null;
  usar_diaria_exclusiva: boolean | null;
  turno: string | null;
  status_funcionario: string | null;
  status_solicitacao: StatusSolicitacao;
  solicitante_id: string | null;
  solicitante_nome: string | null;
  apontador_id: string | null;
  apontador_nome: string | null;
  observacoes: string | null;
  created_at: string;
}

// Tipos para exportação Excel com dados bancários
export interface ExcelDetalhadoComBanco {
  data: string;
  centro_custo: string;
  solicitante: string;
  apontador: string;
  funcionario: string;
  funcao: string;
  valor_diaria: number;
  hora_entrada: string;
  hora_saida: string;
  cpf: string;
  banco: string;
  agencia: string;
  conta_corrente: string;
  chave_pix: string;
}

export interface ExcelTotalizadoPorFuncionario {
  funcionario: string;
  funcao: string;
  cpf: string;
  banco: string;
  agencia: string;
  conta_corrente: string;
  chave_pix: string;
  qtd_dias_trabalhados: number;
  valor_total: number;
}

export interface ResumoDiarias {
  data: string;
  centro_custo_id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  total_presentes: number;
  total_ausentes: number;
  total_pendentes: number;
  total_substituidos: number;
  total_convocados: number;
  total_valor_presentes: number;
  total_valor_previsto: number;
}

// =====================================================
// RESUMOS E ESTATÍSTICAS
// =====================================================

export interface SolicitacaoResumo {
  total: number;
  rascunho: number;
  enviada: number;
  autorizada: number;
  reprovada: number;
}

export interface ConvocacaoResumo {
  total: number;
  rascunho: number;
  enviada_aprovacao: number;
  aprovada: number;
  reprovada: number;
  executando: number;
  finalizada: number;
  cancelada: number;
}

export interface PresencaResumo {
  total: number;
  presentes: number;
  ausentes: number;
  pendentes: number;
  substituidos: number;
  valor_total_presentes: number;
  valor_total_previsto: number;
}

// =====================================================
// EXPORTAÇÃO EXCEL
// =====================================================

export interface ExcelDetalhado {
  data: string;
  centro_custo: string;
  solicitante: string;
  apontador: string;
  funcionario: string;
  funcao: string;
  valor_diaria: number;
  hora_entrada: string;
  hora_saida: string;
}

export interface ExcelResumo {
  data: string;
  centro_custo: string;
  total_presentes: number;
  total_ausentes: number;
  total_valor: number;
}

// =====================================================
// APONTAMENTO DE CAMPO
// =====================================================

export interface DiariaApontamento {
  id: string;
  solicitacao_id: string;
  responsavel_campo_id: string;
  status: StatusApontamento;
  data_abertura: string;
  data_finalizacao: string | null;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  bd_diaria_solicitacoes?: DiariaSolicitacao;
  responsavel_campo?: {
    id: string;
    nome_completo: string;
  };
}

// =====================================================
// FLUXO ADMINISTRATIVO (Etapas 7-10)
// =====================================================

export type StatusFluxo =
  | 'documentos_gerados'
  | 'aguardando_aprovacao_gerente_regional'
  | 'aprovada_gerente_regional'
  | 'aguardando_aprovacao_adm'
  | 'ajuste_solicitado_adm'
  | 'aprovada_adm'
  | 'aguardando_aprovacao_gerenteadm'
  | 'aguardando_aprovacao_diretor_operacional'
  | 'aguardando_aprovacao_diretor_adm'
  | 'finalizado';

export interface FluxoAprovacaoData {
  solicitacao_id: string;
  assinatura_png: string;
  nome_usuario: string;
  cargo: string;
  cpf?: string;
}

export interface AssinaturaAprovacao {
  nome_usuario: string;
  cargo: string | null;
  cpf: string | null;
  assinatura_base64: string | null;
  data_assinatura: string | null;
  hash_assinatura: string | null;
  ip: string | null;
  tipo_assinatura: string | null;
}

export interface DocumentoFluxo {
  id: string;
  solicitacao_id: string;
  tipo_documento: string;
  url_arquivo: string | null;
  versao: number;
  etapa_origem: number | null;
  criado_em: string;
  criado_por: string | null;
}

export interface DocumentoRelacao {
  id: string;
  documento_pai_id: string;
  documento_filho_id: string;
}

export interface EnvioDocumento {
  id: string;
  documento_id: string;
  solicitacao_id: string;
  destino: string;
  data_envio: string;
  status: string;
  criado_por: string | null;
}
