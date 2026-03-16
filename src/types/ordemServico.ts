
export interface OrdemServico {
  id: string;
  numero_os: string;
  chamado_id?: string;
  data_abertura: string;
  data_previsao?: string;
  data_conclusao?: string;
  caminhao_equipamento_id?: string;
  mecanico_id?: string;
  tipo_servico?: string;
  descricao_servico?: string;
  observacoes?: string;
  status: 'Aberta' | 'Em Andamento' | 'Concluída' | 'Cancelada';
  valor_servico?: number;
  pecas_utilizadas?: any;
  created_at?: string;
  updated_at?: string;
  
  // Campos adicionais do cabeçalho Lytorânea
  telefone_solicitante?: string;
  obra_patio?: string;
  setor_executante?: string;
  terceirizada?: boolean;
  tipo_manutencao?: 'Corretiva' | 'Preventiva';
  horimetro_odometro_inicial?: string;
  
  // Campos de balanceamento
  data_inicio_atendimento?: string;
  hora_inicio_atendimento?: string;
  data_encerramento_atendimento?: string;
  hora_encerramento_atendimento?: string;
  horimetro_odometro_final?: string;
  duracao_total?: string;
  executado_por_id?: string;
  encerrado_por_id?: string;
  
  // Campo de tratativa/solução
  tratativa_solucao?: string;
  
  // Relationships
  caminhao_equipamento?: {
    placa: string;
    tipo_veiculo: string;
    fabricante: string;
    modelo: string;
  };
  centro_custo?: {
    codigo_centro_custo: string;
    nome_centro_custo: string;
  };
  solicitante?: {
    email: string;
    nome_completo?: string;
  };
  executado_por?: {
    email: string;
    nome_completo?: string;
  };
  encerrado_por?: {
    email: string;
    nome_completo?: string;
  };
}

export interface Material {
  id: string;
  os_id: string;
  quantidade: number;
  descricao_material: string;
  valor_unitario: number;
  valor_total: number;
  created_at?: string;
  updated_at?: string;
}

export interface MaoDeObra {
  id: string;
  os_id: string;
  quantidade: number;
  funcao: string;
  valor_unitario: number;
  valor_total: number;
  created_at?: string;
  updated_at?: string;
}

export interface Movimentacao {
  id: string;
  os_id: string;
  data_movimentacao: string;
  hora_movimentacao: string;
  usuario_id: string;
  motivo: string;
  created_at?: string;
  usuario?: {
    email: string;
    nome_completo?: string;
  };
}

export interface OsFilterParams {
  numero_os?: string;
  caminhao_equipamento_id?: string;
  data_inicio?: string;
  data_fim?: string;
  status?: string;
}
