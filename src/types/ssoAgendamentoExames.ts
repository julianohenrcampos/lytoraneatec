// Tipos para Agendamento de Exames - Módulo SSO

export type TipoExame = 'Admissional' | 'Periódico' | 'Mudança de Risco' | 'Demissional' | 'Retorno ao Trabalho';
export type StatusAgendamento = 'Pendente' | 'Agendado' | 'Apto' | 'Apto com Restrição' | 'Inapto' | 'Não Compareceu';
export type StatusIntegracao = 'Sem integração' | 'Integrado';
export type ModoAgendamento = 'novo' | 'funcionario_existente';

export const TIPOS_EXAME: TipoExame[] = ['Admissional', 'Periódico', 'Mudança de Risco', 'Demissional', 'Retorno ao Trabalho'];
export const STATUS_AGENDAMENTO: StatusAgendamento[] = ['Pendente', 'Agendado', 'Apto', 'Apto com Restrição', 'Inapto', 'Não Compareceu'];
export const STATUS_INTEGRACAO: StatusIntegracao[] = ['Sem integração', 'Integrado'];

export interface LocalAtendimento {
  id: string;
  nome_local: string;
  endereco: string;
  cidade: string | null;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface AgendamentoExame {
  id: string;
  empresa: string;
  contrato: string | null;
  nome_colaborador: string;
  funcao: string;
  data_nascimento: string | null;
  rg: string | null;
  cpf: string | null;
  tipo_exame: TipoExame;
  data_agendamento: string;
  horario_agendamento: string;
  local_atendimento_id: string;
  observacoes: string | null;
  documentos_anexados: boolean;
  status: StatusAgendamento;
  tecnico_seguranca: string | null;
  criado_em: string;
  criado_por: string;
  
  // NOVOS - Dados de Contato
  telefone_celular: string | null;
  email: string | null;
  
  // NOVOS - Datas de Contratação
  data_inicio_prevista: string | null;
  data_registro_carteira: string | null;
  
  // NOVOS - Checklist Documental
  doc_titulo_eleitor: boolean;
  doc_pis_pasep: boolean;
  doc_certificado_reservista: boolean;
  doc_comprovante_residencia: boolean;
  doc_comprovante_escolaridade: boolean;
  doc_cnh: boolean;
  doc_exame_toxicologico: boolean;
  doc_certidao_filhos: boolean;
  possui_carteira_digital: boolean;
  possui_conta_santander: boolean;
  banco_agencia: string | null;
  banco_conta: string | null;
  
  // NOVOS - Status Contratação
  carteira_assinada: boolean;
  status_integracao: StatusIntegracao;
  
  // NOVOS - Controle de Etapa
  etapa_atual: number;
  etapa1_concluida: boolean;
  
  // Relações
  bd_locais_atendimento?: LocalAtendimento;
  profiles?: {
    id: string;
    nome_completo: string | null;
    email: string | null;
  };
}

// Dados da Etapa 1 - Cadastro Essencial + Checklist
export interface Etapa1FormData {
  nome_colaborador: string;
  telefone_celular: string;
  email: string;
  funcao: string;
  contrato: string;
  empresa: string;
  rg: string;
  cpf: string;
  data_nascimento: string;
  data_inicio_prevista: string;
  // Checklist
  doc_titulo_eleitor: boolean;
  doc_pis_pasep: boolean;
  doc_certificado_reservista: boolean;
  doc_comprovante_residencia: boolean;
  doc_comprovante_escolaridade: boolean;
  doc_cnh: boolean;
  doc_exame_toxicologico: boolean;
  doc_certidao_filhos: boolean;
  possui_carteira_digital: boolean;
  possui_conta_santander: boolean;
  banco_agencia: string;
  banco_conta: string;
}

// Dados da Etapa 2 - Agendamento
export interface Etapa2FormData {
  tipo_exame: TipoExame;
  local_atendimento_id: string;
  data_agendamento: string;
  horario_agendamento: string;
  observacoes: string;
  status: StatusAgendamento;
  documentos_anexados: boolean;
}

// FormData completo (combinação das duas etapas)
export interface AgendamentoExameFormData {
  empresa: string;
  contrato: string;
  nome_colaborador: string;
  funcao: string;
  data_nascimento: string;
  rg: string;
  cpf: string;
  tipo_exame: TipoExame;
  data_agendamento: string;
  horario_agendamento: string;
  local_atendimento_id: string;
  observacoes: string;
  documentos_anexados: boolean;
  status: StatusAgendamento;
  tecnico_seguranca: string;
  // Novos campos
  telefone_celular: string;
  email: string;
  data_inicio_prevista: string;
  data_registro_carteira: string;
  doc_titulo_eleitor: boolean;
  doc_pis_pasep: boolean;
  doc_certificado_reservista: boolean;
  doc_comprovante_residencia: boolean;
  doc_comprovante_escolaridade: boolean;
  doc_cnh: boolean;
  doc_exame_toxicologico: boolean;
  doc_certidao_filhos: boolean;
  possui_carteira_digital: boolean;
  possui_conta_santander: boolean;
  banco_agencia: string;
  banco_conta: string;
  carteira_assinada: boolean;
  status_integracao: StatusIntegracao;
  etapa_atual: number;
  etapa1_concluida: boolean;
}

export interface AgendamentoExameAnexo {
  id: string;
  agendamento_id: string;
  arquivo_nome: string;
  arquivo_path: string;
  tipo: string | null;
  criado_em: string;
  criado_por: string;
  profiles?: {
    id: string;
    nome_completo: string | null;
    email: string | null;
  };
}

export interface AgendamentoExameFilters {
  data?: string;
  status?: string;
  tipo_exame?: string;
  local_atendimento_id?: string;
  empresa?: string;
  nome_colaborador?: string;
  cpf?: string;
  status_integracao?: string;
  carteira_assinada?: string;
}

// Interface para funcionário selecionado (vindo de bd_funcionarios)
export interface FuncionarioSelecionado {
  id: string;
  nome_completo: string;
  email: string | null;
  cpf: string;
  data_nascimento: string | null;
  funcao: string;
  empresa: string;
  centro_custo: string | null;
  banco_agencia: string | null;
  banco_conta: string | null;
}

// Helper functions para badges de status
export const getStatusColor = (status: StatusAgendamento): "default" | "secondary" | "success" | "destructive" | "info" | "warning" | "purple" => {
  switch (status) {
    case 'Pendente':
      return 'secondary';
    case 'Agendado':
      return 'info';
    case 'Apto':
      return 'success';
    case 'Apto com Restrição':
      return 'warning';
    case 'Inapto':
      return 'destructive';
    case 'Não Compareceu':
      return 'purple';
    default:
      return 'default';
  }
};

export const getTipoExameColor = (tipo: TipoExame): "default" | "secondary" | "success" | "warning" | "info" => {
  switch (tipo) {
    case 'Admissional':
      return 'success';
    case 'Periódico':
      return 'info';
    case 'Mudança de Risco':
      return 'warning';
    case 'Demissional':
      return 'secondary';
    case 'Retorno ao Trabalho':
      return 'info';
    default:
      return 'default';
  }
};

export const getStatusIntegracoColor = (status: StatusIntegracao): "default" | "success" => {
  return status === 'Integrado' ? 'success' : 'default';
};

// Helper para calcular data de inicio prevista (+2 dias após agendamento)
export const calcularDataInicioPrevista = (dataAgendamento: string): string => {
  if (!dataAgendamento) return '';
  const data = new Date(dataAgendamento + 'T12:00:00');
  data.setDate(data.getDate() + 2);
  return data.toISOString().split('T')[0];
};

// Helper para calcular data de registro da carteira (+15 dias após inicio)
export const calcularDataRegistroCarteira = (dataInicio: string): string => {
  if (!dataInicio) return '';
  const data = new Date(dataInicio + 'T12:00:00');
  data.setDate(data.getDate() + 15);
  return data.toISOString().split('T')[0];
};

// Helper para calcular progresso do prazo de contratação
export const calcularProgressoPrazo = (dataInicio: string | null, dataLimite: string | null): number => {
  if (!dataInicio || !dataLimite) return 0;
  
  const inicio = new Date(dataInicio);
  const limite = new Date(dataLimite);
  const hoje = new Date();
  
  const totalDias = Math.ceil((limite.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  const diasPassados = Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  
  return Math.min(100, Math.max(0, (diasPassados / totalDias) * 100));
};

// Helper para verificar se prazo está vencido
export const isPrazoVencido = (dataLimite: string | null, carteiraAssinada: boolean): boolean => {
  if (!dataLimite || carteiraAssinada) return false;
  const hoje = new Date();
  const limite = new Date(dataLimite + 'T23:59:59');
  return hoje > limite;
};

// Helper para mapear dados do funcionário para Etapa1FormData
export const mapFuncionarioToEtapa1 = (func: FuncionarioSelecionado): Partial<Etapa1FormData> => ({
  nome_colaborador: func.nome_completo,
  email: func.email || '',
  cpf: func.cpf || '',
  data_nascimento: func.data_nascimento || '',
  funcao: func.funcao,
  empresa: func.empresa,
  contrato: func.centro_custo || '',
  banco_agencia: func.banco_agencia || '',
  banco_conta: func.banco_conta || '',
  telefone_celular: '',
  rg: '',
  data_inicio_prevista: '',
  doc_titulo_eleitor: false,
  doc_pis_pasep: false,
  doc_certificado_reservista: false,
  doc_comprovante_residencia: false,
  doc_comprovante_escolaridade: false,
  doc_cnh: false,
  doc_exame_toxicologico: false,
  doc_certidao_filhos: false,
  possui_carteira_digital: false,
  possui_conta_santander: !!func.banco_conta,
});
