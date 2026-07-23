/**
 * chamadosInternosService — única camada de integração para Chamados Internos.
 *
 * Regras:
 *  - Mutações **somente** via RPCs `fn_chamado_interno_*` (proibido DML direto).
 *  - Leituras via SELECT tipado, respeitando RLS.
 *  - Erros PostgREST/RPC normalizados para `ChamadosInternosError` sem `any`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ChamadoInternoRow,
  ChamadoInternoCategoriaRow,
  ChamadoInternoEventoRow,
  ChamadoInternoAbrirInput,
  ChamadoInternoAbrirResult,
  ChamadoInternoCcAberturaRow,
  ChamadoInternoSolicitanteCcRow,
  ChamadoInternoAtendenteListagemRow,
  ChamadoInternoSetor,
  ChamadoInternoStatus,
  ChamadoFilaAtendimentoRow,
  ChamadosInternosError,
  ChamadosInternosListaFiltro,
} from "@/types/chamadosInternos";

// ---------------- Erro normalizado ----------------
interface PostgrestLikeError {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
}

export function normalizarErro(err: unknown): ChamadosInternosError {
  if (err && typeof err === "object") {
    const e = err as PostgrestLikeError;
    return {
      ...(err as Record<string, unknown>),
      message: typeof e.message === "string" && e.message ? e.message : "Erro desconhecido",
      code: typeof e.code === "string" ? e.code : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      hint: typeof e.hint === "string" ? e.hint : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
    };
  }
  return { message: typeof err === "string" ? err : "Erro desconhecido" };
}

function raise(err: unknown): never {
  throw normalizarErro(err);
}

// ---------------- Leituras ----------------
const CHAMADO_LISTA_COLUMNS =
  "id, protocolo, numero, titulo, status, setor, prioridade, is_critico, sla_prazo, " +
  "centro_custo_id, categoria_id, solicitante_funcionario_id, " +
  "responsavel_atual_profile_id, aberto_por, created_at, updated_at";

export async function listarChamados(
  filtro: ChamadosInternosListaFiltro = {},
): Promise<ChamadoInternoRow[]> {
  let q = supabase
    .from("bd_chamados_internos")
    .select(CHAMADO_LISTA_COLUMNS)
    .order("created_at", { ascending: false });

  if (filtro.status?.length)      q = q.in("status", filtro.status);
  if (filtro.setor?.length)       q = q.in("setor", filtro.setor);
  if (filtro.prioridade?.length)  q = q.in("prioridade", filtro.prioridade);
  if (filtro.centroCustoId)       q = q.eq("centro_custo_id", filtro.centroCustoId);
  if (filtro.categoriaId)         q = q.eq("categoria_id", filtro.categoriaId);
  if (filtro.responsavelProfileId) q = q.eq("responsavel_atual_profile_id", filtro.responsavelProfileId);
  if (filtro.soloCriticos)        q = q.eq("is_critico", true);
  if (filtro.busca && filtro.busca.trim()) {
    const t = filtro.busca.trim().replace(/[%]/g, "");
    q = q.or(`titulo.ilike.%${t}%,protocolo.ilike.%${t}%`);
  }

  const { data, error } = await q;
  if (error) raise(error);
  return (data ?? []) as unknown as ChamadoInternoRow[];
}

export async function obterChamado(id: string): Promise<ChamadoInternoRow | null> {
  const { data, error } = await supabase
    .from("bd_chamados_internos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) raise(error);
  return (data as ChamadoInternoRow | null) ?? null;
}

export async function listarEventos(chamadoId: string): Promise<ChamadoInternoEventoRow[]> {
  const { data, error } = await supabase
    .from("bd_chamado_interno_eventos")
    .select("*")
    .eq("chamado_id", chamadoId)
    .order("created_at", { ascending: true });
  if (error) raise(error);
  return (data ?? []) as ChamadoInternoEventoRow[];
}

export async function listarCategoriasAtivas(): Promise<ChamadoInternoCategoriaRow[]> {
  const { data, error } = await supabase
    .from("bd_chamado_interno_categorias")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  if (error) raise(error);
  return (data ?? []) as ChamadoInternoCategoriaRow[];
}

// ---------------- RPC — lookups ----------------
export async function canOpenCc(ccId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_can_open_cc", { p_cc_id: ccId });
  if (error) raise(error);
  return data === true;
}

export async function canAttend(setor: ChamadoInternoSetor): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_can_attend", { p_setor: setor });
  if (error) raise(error);
  return data === true;
}

export async function canRead(chamadoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_can_read", { p_chamado_id: chamadoId });
  if (error) raise(error);
  return data === true;
}

export async function canOperate(chamadoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_can_operate", { p_chamado_id: chamadoId });
  if (error) raise(error);
  return data === true;
}

export async function listarCcsAbertura(): Promise<ChamadoInternoCcAberturaRow[]> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_listar_ccs_abertura");
  if (error) raise(error);
  return (data ?? []) as ChamadoInternoCcAberturaRow[];
}

export async function listarSolicitantesDoCc(ccId: string): Promise<ChamadoInternoSolicitanteCcRow[]> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_listar_solicitantes_cc", { p_cc_id: ccId });
  if (error) raise(error);
  return (data ?? []) as ChamadoInternoSolicitanteCcRow[];
}

export async function atendentesListar(
  setor: ChamadoInternoSetor,
): Promise<ChamadoInternoAtendenteListagemRow[]> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_atendentes_listar", { p_setor: setor });
  if (error) raise(error);
  return (data ?? []) as ChamadoInternoAtendenteListagemRow[];
}

// alias amigável (leitura de atendentes é apenas via RPC)
export const listarAtendentesDoSetor = atendentesListar;

/**
 * Fila de atendimento — fonte única de escopo operacional.
 * O backend (`fn_chamado_interno_listar_fila_atendimento`) já aplica
 * SuperAdm / AdmSede (por CC) / Atendente (por setor) via `fn_chamado_interno_can_operate`.
 * O frontend NÃO deve reaplicar filtro de segurança client-side.
 */
export async function listarFilaAtendimento(
  params: {
    status?: ChamadoInternoStatus[];
    setor?: ChamadoInternoSetor | null;
  } = {},
): Promise<ChamadoFilaAtendimentoRow[]> {
  const rpcArgs: {
    p_setor?: ChamadoInternoSetor;
    p_status?: ChamadoInternoStatus[];
  } = {};
  if (params.setor) rpcArgs.p_setor = params.setor;
  if (params.status?.length) rpcArgs.p_status = params.status;
  const { data, error } = await supabase.rpc(
    "fn_chamado_interno_listar_fila_atendimento",
    rpcArgs,
  );
  if (error) raise(error);
  return (data ?? []) as ChamadoFilaAtendimentoRow[];
}

// ---------------- Leitura administrativa de profiles (para vincular atendentes) ----------------
export interface ProfileAdminSafeRow {
  id: string;
  nome_completo: string | null;
  email: string | null;
  funcao_sistema: string | null;
}

/**
 * Lista profiles via view SECURITY INVOKER `vw_profiles_admin_safe`.
 * RLS controla o acesso (SuperAdm/AdmChamadosInternos). Nunca expõe DDL/PII sensível.
 */
export async function listarProfilesAdminSafe(
  busca?: string,
): Promise<ProfileAdminSafeRow[]> {
  let q = supabase
    .from("vw_profiles_admin_safe")
    .select("id, nome_completo, email, funcao_sistema")
    .order("nome_completo", { ascending: true })
    .limit(200);
  const t = busca?.trim();
  if (t) {
    const s = t.replace(/[%]/g, "");
    q = q.or(`nome_completo.ilike.%${s}%,email.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) raise(error);
  return (data ?? []).filter((r) => !!r.id) as ProfileAdminSafeRow[];
}

// ---------------- RPC — mutações operacionais ----------------
export async function abrir(input: ChamadoInternoAbrirInput): Promise<ChamadoInternoAbrirResult> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_abrir", input);
  if (error) raise(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) raise(new Error("RPC fn_chamado_interno_abrir não retornou dados"));
  return row as ChamadoInternoAbrirResult;
}

export async function assumir(chamadoId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_assumir", { p_chamado_id: chamadoId });
  if (error) raise(error);
}

export async function responder(chamadoId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_responder", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
  });
  if (error) raise(error);
}

export async function solicitarInformacao(chamadoId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_solicitar_informacao", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
  });
  if (error) raise(error);
}

export async function adicionarNotaInterna(chamadoId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_adicionar_nota_interna", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
  });
  if (error) raise(error);
}

export async function resolver(chamadoId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_resolver", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
  });
  if (error) raise(error);
}

export async function responderSolicitante(chamadoId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_responder_solicitante", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
  });
  if (error) raise(error);
}

export async function confirmarEncerramento(chamadoId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_confirmar_encerramento", {
    p_chamado_id: chamadoId,
  });
  if (error) raise(error);
}

export async function reabrir(chamadoId: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_reabrir", {
    p_chamado_id: chamadoId,
    p_mensagem: mensagem,
  });
  if (error) raise(error);
}

export async function cancelar(chamadoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_cancelar", {
    p_chamado_id: chamadoId,
    p_motivo: motivo,
  });
  if (error) raise(error);
}

// ---------------- RPC — administração de atendentes ----------------
export async function atendenteVincular(
  profileId: string,
  setor: ChamadoInternoSetor,
): Promise<string> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_atendente_vincular", {
    p_profile_id: profileId,
    p_setor: setor,
  });
  if (error) raise(error);
  return data as string;
}

export async function atendenteDesativar(vinculoId: string): Promise<void> {
  const { error } = await supabase.rpc("fn_chamado_interno_atendente_desativar", {
    p_vinculo_id: vinculoId,
  });
  if (error) raise(error);
}
