
// Define o tipo base da Equipe
export interface Equipe {
  id: string;
  nome_equipe: string;
  encarregado_id: string;
  apontador_id: string;
  equipe: string[];
  created_at?: string;
  updated_at?: string;

  // Relações (populadas por JOINs no Supabase)
  encarregado?: {
    id: string;
    nome_completo: string;
  } | null;

  apontador?: {
    id: string;
    nome_completo: string;
  } | null;

  membros?: {
    id: string;
    nome_completo: string;
  }[] | null;
}

// Dados do formulário para criar ou atualizar uma equipe
export interface EquipeFormData {
  nome_equipe: string;
  encarregado_id: string;
  apontador_id: string;
  equipe: string[];
}

// Opções de filtro para equipes
export interface EquipeFilter {
  nome_equipe?: string;
  encarregado_id?: string;
  apontador_id?: string;
}
