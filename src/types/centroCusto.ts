
export interface CentroCusto {
  id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  cnpj_vinculado: string | null;
  telefone: string | null;
  situacao: 'Ativo' | 'Inativo';
  aprovador_diarias_id: string | null;
  created_at?: string;
  updated_at?: string;
  // Relação expandida
  aprovador_diarias?: {
    id: string;
    nome_completo: string;
    email?: string;
  };
  diretoria_id: string | null;
  diretoria?: {
    id: string;
    nome: string;
  };
  departamento_id: string | null;
  departamento?: {
    id: string;
    nome_departamento: string;
  };
  adm_sede_funcionario_id: string | null;
  adm_sede_funcionario?: {
    id: string;
    nome_completo: string;
  };
  adm_obra_funcionario_id: string | null;
  adm_obra_funcionario?: {
    id: string;
    nome_completo: string;
  };
  // Endereço e geolocalização
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  endereco_completo: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoding_status: string | null;
}

export interface CentroCustoFormData {
  codigo_centro_custo: string;
  nome_centro_custo: string;
  cnpj_vinculado?: string;
  telefone?: string;
  situacao: 'Ativo' | 'Inativo';
  aprovador_diarias_id?: string;
  diretoria_id?: string;
  adm_sede_funcionario_id?: string;
  adm_obra_funcionario_id?: string;
  departamento_id?: string;
  // Endereço e geolocalização
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  endereco_completo?: string;
  latitude?: number;
  longitude?: number;
  geocoding_status?: string;
}

export interface CentroCustoFilter {
  busca?: string;
  codigo_centro_custo?: string;
  nome_centro_custo?: string;
  cnpj_vinculado?: string;
  telefone?: string;
  situacao?: string;
}
