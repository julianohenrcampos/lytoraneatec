
export interface Veiculo {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  departamento_id: string | null;
  placa: string | null;
  fabricante: string | null;
  cor: string | null;
  motor: string | null;
  ano_fabricacao: string | null;
  tipo_combustivel: string | null;
  status_ipva: 'Pago' | 'Pendente' | string | null;
  situacao: 'Operando' | 'Em Manutenção' | 'Disponível' | 'Intempérie' | string | null;
  capacidade: string | null;
  aluguel: string | null;
  observacoes: string | null;
  imagem_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  empresa_id: string | null;
  
  // Category fields (replace legacy tipo_veiculo / modelo)
  categoria_ativo_id: string | null;
  subcategoria_ativo_id: string | null;
  numero_serie: string | null;
  chassi: string | null;
  informacoes_complementares: string | null;
  status_cadastro: string | null;
  status_disponibilidade: string | null;
  proprietario_tipo: string | null;
  tipo_ativo: string | null;
  empresa_locadora_id: string | null;
  linha_operacional_id: string | null;
  tipo_equipamento_id: string | null;
  
  modelo_id?: string | null;
  modelo?: string | null;

  // Join fields
  nome_departamento?: string;
  nome_empresa?: string;
  nome_categoria?: string;
  nome_subcategoria?: string;
  nome_empresa_locadora?: string;
  nome_centro_custo?: string;
  centro_custo_id?: string | null;
  // Rodada 2A.3 — Campos relacionais hidratados
  frota_codigo?: string | null;
  fabricante_nome?: string | null;
  modelo_nome?: string | null;


  // Alocação atual (projeção autoritativa persistida em bd_caminhoes_equipamentos)
  centro_custo_atual_id?: string | null;
  centro_custo_atual_codigo?: string | null;
  centro_custo_atual_nome?: string | null;
  centro_custo_origem?: 'CADASTRO' | 'APONTAMENTO_CE' | 'DISPONIBILIDADE' | 'CENTRAL_TRANSPORTE' | 'SEM_ALOCACAO' | null;
  ultimo_apontamento_id?: string | null;
  centro_custo_atualizado_em?: string | null;
  centro_custo_atualizado_por?: string | null;
}

export interface VeiculoAlocacaoAtual {
  equipamento_id: string;
  centro_custo_atual_id: string | null;
  centro_custo_atual_codigo: string | null;
  centro_custo_atual_nome: string | null;
  centro_custo_origem: 'CADASTRO' | 'APONTAMENTO_CE' | 'DISPONIBILIDADE' | 'CENTRAL_TRANSPORTE' | 'SEM_ALOCACAO';
  ultimo_apontamento_id: string | null;
  centro_custo_atualizado_em: string | null;
}

// VeiculoFormData: apenas o que pode ser gravado pelo formulário.
// Colunas de projeção (origem/atualizado_em/atualizado_por), joins de leitura,
// centro_custo_atual_codigo/nome, ultimo_apontamento_id e o legado centro_custo_id
// NUNCA são enviadas em UPDATE (ver strip explícito em updateVeiculo).
// Único campo operacional novo permitido: centro_custo_atual_id (apenas no CREATE).
export type VeiculoFormData = Omit<
  Veiculo,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'nome_departamento'
  | 'nome_empresa'
  | 'nome_categoria'
  | 'nome_subcategoria'
  | 'nome_empresa_locadora'
  | 'nome_centro_custo'
  | 'centro_custo_id'
  | 'centro_custo_atual_codigo'
  | 'centro_custo_atual_nome'
  | 'centro_custo_origem'
  | 'centro_custo_atualizado_em'
  | 'centro_custo_atualizado_por'
  | 'ultimo_apontamento_id'
  | 'frota_codigo'
  | 'fabricante_nome'
  | 'modelo_nome'
>;

export interface VeiculoFilterParams {
  frota?: string;
  departamento_id?: string;
  placa?: string;
  fabricante?: string;
  situacao?: string;
  empresa_id?: string;
  categoria_ativo_id?: string;
  subcategoria_ativo_id?: string;
  capacidade?: string;
}

export type VeiculoFilter = VeiculoFilterParams;
