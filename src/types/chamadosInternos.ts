/**
 * Tipos do módulo Chamados Internos.
 * Fonte da verdade: `src/integrations/supabase/types.ts` gerado pelo Supabase.
 * Nenhum tipo duplica ENUMs ou colunas — todos derivam de `Database`.
 */
import type { Database } from "@/integrations/supabase/types";

// ---------- Rows das tabelas canônicas (M1–M7) ----------
export type ChamadoInternoRow =
  Database["public"]["Tables"]["bd_chamados_internos"]["Row"];

export type ChamadoInternoCategoriaRow =
  Database["public"]["Tables"]["bd_chamado_interno_categorias"]["Row"];

export type ChamadoInternoEventoRow =
  Database["public"]["Tables"]["bd_chamado_interno_eventos"]["Row"];

/** Evento + nome completo do autor (RPC fn_chamado_interno_eventos_listar). */
export interface ChamadoInternoEventoComAutor extends ChamadoInternoEventoRow {
  autor_nome: string | null;
}

export type ChamadoInternoAtendenteRow =
  Database["public"]["Tables"]["bd_chamado_interno_atendentes"]["Row"];

// ---------- ENUMs ----------
export type ChamadoInternoStatus =
  Database["public"]["Enums"]["chamado_interno_status"];

export type ChamadoInternoSetor =
  Database["public"]["Enums"]["chamado_interno_setor"];

export type ChamadoInternoPrioridade =
  Database["public"]["Enums"]["chamado_interno_prioridade"];

export type ChamadoInternoEventoTipo =
  Database["public"]["Enums"]["chamado_interno_evento_tipo"];

// ---------- Erro normalizado (sem `any`) ----------
export interface ChamadosInternosError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  /** HTTP status (PostgREST), preservado apenas como metadado — não usar para classificar estado do chamado. */
  status?: number;
}

// ---------- I/O das RPCs (assinaturas verificadas em pg_proc) ----------
export interface ChamadoInternoAbrirInput {
  p_centro_custo_id: string;
  p_categoria_id: string;
  p_solicitante_funcionario_id: string;
  p_titulo: string;
  p_descricao: string;
}

export interface ChamadoInternoAbrirResult {
  chamado_id: string;
  numero: number;
  protocolo: string;
}

export interface ChamadoInternoCcAberturaRow {
  centro_custo_id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
}

export interface ChamadoInternoSolicitanteCcRow {
  id: string;
  nome_completo: string;
}

export interface ChamadoInternoAtendenteListagemRow {
  id: string;
  atendente_profile_id: string;
  setor: ChamadoInternoSetor;
  ativo: boolean;
  profile_nome: string | null;
  funcionario_nome_completo: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Fila de atendimento (RPC fn_chamado_interno_listar_fila_atendimento) ----------
export interface ChamadoFilaAtendimentoRow {
  id: string;
  protocolo: string;
  titulo: string;
  status: ChamadoInternoStatus;
  setor: ChamadoInternoSetor;
  prioridade: ChamadoInternoPrioridade;
  is_critico: boolean;
  sla_prazo: string;
  centro_custo_id: string;
  centro_custo_codigo: string;
  centro_custo_nome: string;
  categoria_id: string;
  categoria_nome: string;
  responsavel_atual_profile_id: string | null;
  fonte_autorizacao: string;
  solicitante_funcionario_id: string | null;
  solicitante_nome: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Enriquecimento de lista (RPC fn_chamado_interno_enriquecer_lista) ----------
export interface ChamadoInternoEnriquecimentoRow {
  chamado_id: string;
  centro_custo_codigo: string | null;
  centro_custo_nome: string | null;
  solicitante_funcionario_id: string | null;
  solicitante_nome: string | null;
  /** Nome completo de quem abriu o chamado (ex. AdmObra). */
  aberto_por_nome: string | null;
}

// ---------- Nomes das pessoas do chamado (RPC fn_chamado_interno_detalhe_pessoas) ----------
export interface ChamadoInternoPessoasRow {
  solicitante_nome: string | null;
  aberto_por_nome: string | null;
  responsavel_nome: string | null;
}

// ---------- Anexos ----------
export type ChamadoInternoAnexoRow =
  Database["public"]["Tables"]["bd_chamado_interno_anexos"]["Row"];

/** Metadados enviados para a RPC de registro dos anexos. */
export interface ChamadoInternoAnexoMeta {
  storage_path: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
}

export const CHAMADO_ANEXO_MIMES_ACEITOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const CHAMADO_ANEXO_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const CHAMADO_ANEXO_MAX_ARQUIVOS = 5;


// ---------- Filtros de listagem ----------
export interface ChamadosInternosListaFiltro {
  status?: ChamadoInternoStatus[];
  setor?: ChamadoInternoSetor[];
  prioridade?: ChamadoInternoPrioridade[];
  centroCustoId?: string;
  categoriaId?: string;
  responsavelProfileId?: string;
  soloCriticos?: boolean;
  busca?: string;
}

// ---------- Capabilities de ações (helper puro) ----------
export interface ChamadoCapabilitiesInput {
  chamado: Pick<
    ChamadoInternoRow,
    | "status"
    | "setor"
    | "responsavel_atual_profile_id"
    | "aberto_por"
    | "solicitante_funcionario_id"
  >;
  profileId: string | null;
  funcionarioId: string | null;
  /** SuperAdm reconhecido pelo hook central de permissões. */
  isSuperAdmin?: boolean;
  /** `profiles.acesso_global`, quando disponível no perfil seguro. */
  acessoGlobal?: boolean;
  /** Resultado operacional de backend (`fn_chamado_interno_can_operate`). */
  canAttendSetor: boolean;
  permissions: {
    /** chamados_internos_atender / visualizar */
    canVisualizarAtendimento: boolean;
    /** chamados_internos_atender / editar */
    canEditarAtendimento: boolean;
    /** chamados_internos_admin / editar */
    canAdministrarEditar: boolean;
    /** chamados_internos_abrir / editar */
    canAbrirEditar: boolean;
  };
}

export interface ChamadoActionCapabilities {
  canAssumir: boolean;
  canResponder: boolean;
  canSolicitarInformacao: boolean;
  canAdicionarNotaInterna: boolean;
  canResolver: boolean;
  canCancelar: boolean;
  /** Confirmar encerramento — ato do solicitante/abridor ou admin, só em `resolvido`. */
  canConfirmarEncerramento: boolean;
  /** Reabrir — ato do solicitante/abridor ou admin. */
  canReabrir: boolean;
  showAcoesAtendenteTab: boolean;
}

