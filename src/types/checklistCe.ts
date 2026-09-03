// =============================================================
// Contrato do Snapshot Detalhado do Checklist C&E (schema v1)
// =============================================================
// Persistido em bd_registro_apontamento_inspecao:
//   checklist_codigo   text     (ex.: "CE-ESCAVADEIRA-V1")
//   checklist_versao   integer  (ex.: 1)
//   checklist_respostas jsonb   (objeto ChecklistCeSnapshot ou null p/ legado)

import type { ChecklistCeTemplateCodigo } from "@/constants/checklistCeTemplates";

export type ChecklistValor = "OK" | "NAO_OK" | "NA";

/** Estado de um item durante EDIÇÃO no formulário (permite indefinido). */
export interface ChecklistCeItemDraft {
  codigo: string;
  status?: ChecklistValor;
  observacao?: string;
  fotos?: string[]; // storage paths JÁ enviados
  fotosNovas?: File[]; // arquivos pendentes de upload
  fotosRemovidas?: string[]; // paths a apagar do storage
}

/** Estado do checklist detalhado no formulário. */
export interface ChecklistCeDraft {
  templateCodigo: ChecklistCeTemplateCodigo;
  versao: number;
  itens: Record<string, ChecklistCeItemDraft>;
}

// ============= Snapshot autoritativo (persistido) =============

export interface ChecklistCeSnapshotItem {
  codigo: string;
  ordem: number;
  descricao: string;
  criticidade: "baixa" | "media" | "alta";
  obrigatorio: boolean;
  status: ChecklistValor | null;
  observacao: string | null;
  fotos: string[]; // storage paths
}

export interface ChecklistCeSnapshotGrupo {
  codigo: string;
  titulo: string;
  ordem: number;
  itens: ChecklistCeSnapshotItem[];
}

export interface ChecklistCeSnapshotAtivo {
  id: string;
  frota: string | null;
  numero_frota: string | null;
  placa: string | null;
  fabricante: string | null;
  ano_fabricacao: number | null;
  imagem_url: string | null;
  subcategoria_id: string | null;
  subcategoria_nome: string | null;
}

export interface ChecklistCeSnapshotResumo {
  total_itens: number;
  obrigatorios_total: number;
  obrigatorios_respondidos: number;
  ok: number;
  nao_ok: number;
  na: number;
  aprovado: boolean;
}

export interface ChecklistCeSnapshot {
  schema_version: 1;
  template_codigo: ChecklistCeTemplateCodigo;
  template_versao: number;
  ativo: ChecklistCeSnapshotAtivo;
  grupos: ChecklistCeSnapshotGrupo[];
  resumo: ChecklistCeSnapshotResumo;
  gerado_em: string; // ISO
}

export const isDetalhado = (
  respostas: unknown
): respostas is ChecklistCeSnapshot =>
  !!respostas &&
  typeof respostas === "object" &&
  (respostas as any).schema_version === 1 &&
  Array.isArray((respostas as any).grupos);
