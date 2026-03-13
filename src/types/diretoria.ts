export interface Diretoria {
  id: string;
  nome: string;
  diretor_id: string | null;
  tipo: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  modificado_por?: string | null;
  // Relação expandida
  diretor?: {
    id: string;
    nome_completo: string;
  };
}

export interface DiretoriaFormData {
  nome: string;
  diretor_id?: string;
  tipo: string;
  ativo: boolean;
}
