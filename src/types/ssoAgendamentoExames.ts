// Tipos para Agendamento de Exames - Módulo SSO

export type TipoExame = 'Admissional' | 'Periódico' | 'Mudança de Risco' | 'Demissional' | 'Retorno ao Trabalho';
export type StatusAgendamento = 'Pendente' | 'Agendado' | 'Apto' | 'Apto com Restrição' | 'Inapto' | 'Não Compareceu';
export type StatusIntegracao = 'Sem integração' | 'Integrado';
export type StatusCarteira = 'Pendente' | 'Registrado' | 'Revisado';
export type ModoAgendamento = 'novo' | 'funcionario_existente';
export type MotivoMudancaRisco = 'Promoção' | 'Mudança de Setor';
export const MOTIVOS_MUDANCA_RISCO: MotivoMudancaRisco[] = ['Promoção', 'Mudança de Setor'];
export type MotivoContratacao = 'Nova Contratação' | 'Substituição';
export const MOTIVOS_CONTRATACAO: MotivoContratacao[] = ['Nova Contratação', 'Substituição'];

export const TIPOS_EXAME: TipoExame[] = ['Admissional', 'Periódico', 'Mudança de Risco', 'Demissional', 'Retorno ao Trabalho'];
export const STATUS_AGENDAMENTO: StatusAgendamento[] = ['Pendente', 'Agendado', 'Apto', 'Apto com Restrição', 'Inapto', 'Não Compareceu'];
export const STATUS_INTEGRACAO: StatusIntegracao[] = ['Sem integração', 'Integrado'];
export const STATUS_CARTEIRA: StatusCarteira[] = ['Pendente', 'Registrado', 'Revisado'];

export interface LocalAtendimento {
  id: string;
  nome_local: string;
  endereco: string;
  cidade: string | null;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
  dias_atendimento: string[];
  horario_inicio: string;
  horario_fim: string;
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
  status_carteira: StatusCarteira;
  status_integracao: StatusIntegracao;
  
  // NOVOS - Controle de Etapa
  etapa_atual: number;
  etapa1_concluida: boolean;
  
  // Mudança de Risco
  motivo_mudanca_risco: MotivoMudancaRisco | null;
  
  // Data do resultado do exame (quando status mudou para Apto)
  data_resultado_exame: string | null;
  
  // Benefícios VT/VR
  vt_solicitado_em: string | null;
  vt_entregue_em: string | null;
  vr_solicitado_em: string | null;
  vr_entregue_em: string | null;
  
  // Motivo da contratação
  motivo_contratacao: MotivoContratacao | null;
  
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
  motivo_mudanca_risco: string;
  motivo_contratacao: string;
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
  status_carteira: StatusCarteira;
  status_integracao: StatusIntegracao;
  etapa_atual: number;
  etapa1_concluida: boolean;
  motivo_mudanca_risco: string;
  motivo_contratacao: string;
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
  data_inicio?: string;
  data_fim?: string;
  funcao?: string;
  status?: string;
  tipo_exame?: string;
  local_atendimento_id?: string;
  empresa?: string;
  nome_colaborador?: string;
  cpf?: string;
  status_integracao?: string;
  status_carteira?: string;
  contrato?: string[];
}

// Interface para funcionário selecionado (vindo de bd_funcionarios)
export interface FuncionarioSelecionado {
  id: string;
  nome_completo: string;
  email: string | null;
  cpf: string;
  data_nascimento: string | null;
  telefone_celular: string | null;
  funcao: string;
  empresa: string;
  centro_custo: string | null;
  banco_agencia: string | null;
  banco_conta: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
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

export const getStatusCarteiraColor = (status: string): "default" | "secondary" | "success" | "info" | "destructive" => {
  switch (status) {
    case 'Registrado': return 'success';
    case 'Revisado': return 'info';
    default: return 'secondary';
  }
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

// Prazo de contratação: 18 dias regressivos a partir de data_resultado_exame
export const PRAZO_CONTRATACAO_DIAS = 18;

export const calcularPrazoContratacao = (dataResultado: string | null): { diasRestantes: number; diasPassados: number; progresso: number } => {
  if (!dataResultado) return { diasRestantes: PRAZO_CONTRATACAO_DIAS, diasPassados: 0, progresso: 0 };
  
  const inicio = new Date(dataResultado + 'T12:00:00');
  const hoje = new Date();
  const diasPassados = Math.max(0, Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
  const diasRestantes = PRAZO_CONTRATACAO_DIAS - diasPassados;
  const progresso = Math.min(100, Math.max(0, (diasPassados / PRAZO_CONTRATACAO_DIAS) * 100));
  
  return { diasRestantes, diasPassados, progresso };
};

export const isPrazoVencido = (dataResultado: string | null, statusCarteira: string): boolean => {
  if (!dataResultado || statusCarteira === 'Registrado' || statusCarteira === 'Revisado') return false;
  const { diasRestantes } = calcularPrazoContratacao(dataResultado);
  return diasRestantes <= 0;
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
  telefone_celular: func.telefone_celular || '',
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

// Helper para calcular estado de um benefício (VT ou VR)
export type EstadoBeneficio = 'entregue' | 'em_andamento' | 'atrasado' | 'pendente';

export const calcularEstadoBeneficio = (
  solicitadoEm: string | null,
  entregueEm: string | null,
  dataFallback: string
): { estado: EstadoBeneficio; diasDecorridos: number; percentual: number } => {
  if (entregueEm) {
    return { estado: 'entregue', diasDecorridos: 0, percentual: 100 };
  }
  
  const dataInicio = solicitadoEm || dataFallback;
  if (!dataInicio) {
    return { estado: 'pendente', diasDecorridos: 0, percentual: 0 };
  }
  
  const inicio = new Date(dataInicio + 'T12:00:00');
  const hoje = new Date();
  const diasDecorridos = Math.max(0, Math.ceil((hoje.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
  const percentual = Math.min(diasDecorridos / 10, 1) * 100;
  
  if (diasDecorridos > 10) {
    return { estado: 'atrasado', diasDecorridos, percentual: 100 };
  }
  
  if (solicitadoEm) {
    return { estado: 'em_andamento', diasDecorridos, percentual };
  }
  
  return { estado: 'pendente', diasDecorridos, percentual: 0 };
};

export type EstadoGeralBeneficios = 'concluido' | 'em_andamento' | 'a_solicitar';

export const calcularEstadoGeralBeneficios = (agendamento: AgendamentoExame): EstadoGeralBeneficios => {
  const vtEstado = calcularEstadoBeneficio(agendamento.vt_solicitado_em, agendamento.vt_entregue_em, agendamento.data_agendamento);
  const vrEstado = calcularEstadoBeneficio(agendamento.vr_solicitado_em, agendamento.vr_entregue_em, agendamento.data_agendamento);
  
  if (vtEstado.estado === 'entregue' && vrEstado.estado === 'entregue') return 'concluido';
  if (vtEstado.estado === 'pendente' && vrEstado.estado === 'pendente') return 'a_solicitar';
  return 'em_andamento';
};
