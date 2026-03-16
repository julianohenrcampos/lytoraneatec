
export interface Veiculo {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  departamento_id: string | null;
  placa: string | null;
  tipo_veiculo: 'Caminhão' | 'Equipamento' | 'Prancha' | 'Van' | 'Ônibus' | string;
  fabricante: string | null;
  modelo: string | null;
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
  
  // New fields
  categoria_ativo_id: string | null;
  subcategoria_ativo_id: string | null;
  numero_serie: string | null;
  chassi: string | null;
  informacoes_complementares: string | null;
  status_cadastro: string | null;
  status_disponibilidade: string | null;
  proprietario_tipo: string | null;
  
  // Join fields
  nome_departamento?: string;
  nome_empresa?: string;
  nome_categoria?: string;
  nome_subcategoria?: string;
}

export type VeiculoFormData = Omit<Veiculo, 'id' | 'created_at' | 'updated_at' | 'nome_departamento' | 'nome_empresa' | 'nome_categoria' | 'nome_subcategoria'>;

export interface VeiculoFilterParams {
  frota?: string;
  departamento_id?: string;
  placa?: string;
  tipo_veiculo?: string;
  fabricante?: string;
  modelo?: string;
  situacao?: string;
  empresa_id?: string;
  categoria_ativo_id?: string;
}

export type VeiculoFilter = VeiculoFilterParams;
