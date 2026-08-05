// Tipos do módulo POPs (Procedimentos Operacionais Padrão).
// Modelo definitivo: SEM histórico documental.
// Existem apenas o documento vigente (bd_pops) e a revisão em preparação
// (bd_pop_rascunhos). Não há versões arquivadas.

export type PopStatus = 'rascunho' | 'ativo' | 'obsoleto';
export type PopTipoIncremento = 'initial' | 'minor' | 'major';

export interface Pop {
  id: string;
  codigo: string;
  titulo: string;
  categoria: string | null;
  setor_id: string;
  status: PopStatus;
  versao_major: number;
  versao_minor: number;
  publicado_em: string | null;
  obsoleto_em: string | null;
  motivo_obsolescencia: string | null;
  elaborado_por_id: string | null;
  elaborado_por_nome_snapshot: string | null;
  arquivo_path: string | null;
  arquivo_nome_original: string | null;
  arquivo_tamanho_bytes: number | null;
  arquivo_sha256: string | null;
  created_at: string;
  updated_at: string;
}

export interface PopRascunho {
  id: string;
  pop_id: string;
  codigo: string;
  titulo: string;
  categoria: string | null;
  setor_id: string;
  tipo_incremento: PopTipoIncremento;
  motivo_revisao: string;
  elaborado_por_id: string;
  elaborado_por_nome_snapshot: string;
  arquivo_path: string | null;
  arquivo_nome_original: string | null;
  arquivo_tamanho_bytes: number | null;
  arquivo_sha256: string | null;
  created_at: string;
  updated_at: string;
}

/** Item consolidado usado na tela de gestão: vigente + revisão em preparação. */
export interface PopComRascunho extends Pop {
  setor_nome?: string | null;
  rascunho?: PopRascunho | null;
}

export interface PopSetorOption {
  id: string;
  nome_departamento: string;
}

export interface PopPublicacaoResultado {
  pop_id: string;
  versao_major: number;
  versao_minor: number;
  arquivo_sha256: string | null;
}

export const POPS_MAX_ARQUIVO_BYTES = 20 * 1024 * 1024;
