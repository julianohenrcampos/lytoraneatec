// Tipos para o módulo SSO - Checklists NR-18

export type AvaliacaoTipo = 'Conforme' | 'Não Conforme' | 'NA';
export type ResultadoAvaliacao = 'Crítico' | 'Em Atenção' | 'Satisfatório' | 'Excelente';

export interface SSOItemModelo {
  id: string;
  ordem: number;
  tema: string;
  descricao: string;
  created_at?: string;
  updated_at?: string;
}

export interface SSOFoto {
  path: string;
  url?: string;
  created_at: string;
}

export interface SSOChecklistItem {
  id: string;
  checklist_id: string;
  item_modelo_id: string;
  avaliacao: AvaliacaoTipo;
  evidencia?: string;
  fotos: SSOFoto[];
  ordem: number;
  tema: string;
  descricao: string;
  created_at?: string;
  updated_at?: string;
}

export interface SSOChecklist {
  id: string;
  obra_id: string;
  gerente_regional: string;
  engenheiro_obra: string;
  tecnico_seguranca: string;
  data_inspecao: string;
  nota_objetivo: number;
  nota_real?: number;
  resultado_avaliacao?: ResultadoAvaliacao;
  total_itens: number;
  total_aplicaveis?: number;
  total_conformes?: number;
  total_na?: number;
  total_efetivo?: number;
  observacoes_gerais?: string;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  
  // Relações expandidas
  bd_centros_custo?: {
    id: string;
    nome_centro_custo: string;
    codigo_centro_custo: string;
  };
  profiles?: {
    id: string;
    nome_completo?: string;
    email?: string;
  };
  bd_sso_checklist_itens?: SSOChecklistItem[];
}

export interface SSOChecklistFormData {
  obra_id: string;
  gerente_regional: string;
  engenheiro_obra: string;
  tecnico_seguranca: string;
  data_inspecao: string;
  total_efetivo?: number;
  observacoes_gerais?: string;
}

export interface SSOChecklistFilters {
  obra_id?: string;
  data_inspecao?: string;
  data_inicio?: string;
  data_fim?: string;
  resultado_avaliacao?: ResultadoAvaliacao;
  criado_por?: string;
}

export interface SSODashboardData {
  total_checklists: number;
  nota_media: number;
  conformidade_geral: number;
  distribuicao_resultados: {
    critico: number;
    em_atencao: number;
    satisfatorio: number;
    excelente: number;
  };
  conformidade_por_tema: {
    tema: string;
    conformidade: number;
    total_avaliacoes: number;
  }[];
  evolucao_temporal: {
    data: string;
    nota_media: number;
    obra: string;
  }[];
  top_nao_conformidades: {
    tema: string;
    descricao: string;
    percentual_nc: number;
    ocorrencias: number;
    ultima_inspecao: string;
    qtd_fotos: number;
  }[];
}
