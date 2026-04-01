
export interface Empresa {
  id: string;
  nome_empresa: string;
  cnpj: string;
  telefone: string | null;
  situacao: 'Ativa' | 'Inativa';
  tipo_empresa?: string | null;
  pertence_ao_grupo?: boolean | null;
  fornece_equipamento?: boolean | null;
  status_homologacao?: string | null;
  endereco_completo?: string | null;
  endereco_cep?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_latitude?: number | null;
  endereco_longitude?: number | null;
  logo_url?: string | null;
  pessoa_tipo?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  nome_contato?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string | null;
  pix?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type EmpresaFormData = Omit<Empresa, 'id' | 'created_at' | 'updated_at'>;

export interface EmpresaFilterParams {
  nome_empresa?: string;
  cnpj?: string;
  telefone?: string;
  situacao?: 'Ativa' | 'Inativa' | 'all' | '';
  tipo_empresa?: string;
}
