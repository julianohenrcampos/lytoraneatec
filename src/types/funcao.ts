
export interface Funcao {
  id: string;
  nome_funcao: string;
  valor_diaria?: number;
  valor_diaria_exclusiva?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FuncaoFormData {
  nome_funcao: string;
  valor_diaria?: number;
  valor_diaria_exclusiva?: number;
}

export interface FuncaoFilter {
  nome_funcao?: string;
}
