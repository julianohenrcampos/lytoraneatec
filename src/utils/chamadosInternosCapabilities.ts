/**
 * Helper puro de capacidades de ação para Chamados Internos.
 *
 * Sem React, sem React Query, sem Supabase. Recebe o estado atual do chamado,
 * do usuário e do RBAC action-aware, e devolve os booleans que a UI usa para
 * decidir quais botões renderizar. O backend continua sendo a autoridade final
 * (RPCs `fn_chamado_interno_*` com `SECURITY DEFINER`); este helper apenas
 * oculta o que o backend recusaria.
 *
 * Regras auditadas em `pg_get_functiondef` das RPCs:
 *  - Assumir/Responder/Solicitar informação/Nota interna/Resolver:
 *      exigem `atender/editar` + vínculo ativo no setor + (para as demais)
 *      `responsavel_atual = auth.uid()`.
 *  - Cancelar:
 *      `admin/editar` OU (`abrir/editar` E (aberto_por=me OU solicitante_funcionario=meu)).
 *
 * Gate operacional (fail-closed):
 *  - Sem `atender/visualizar`, nenhuma ação operacional é exposta, mesmo com
 *    `atender/editar=true`. Configuração `editar sem visualizar` é considerada
 *    inválida no plano RBAC e tratada como bloqueio total.
 *
 * SuperAdm / acesso_global recebem bypass visual apenas quando o backend já
 * confirmou capacidade operacional para o chamado via `canAttendSetor`.
 */
import type {
  ChamadoActionCapabilities,
  ChamadoCapabilitiesInput,
  ChamadoInternoStatus,
  ChamadosInternosError,
} from "@/types/chamadosInternos";

const STATUS_ASSUMIR: ReadonlyArray<ChamadoInternoStatus> = [
  "aberto",
  "em_triagem",
  "em_analise",
  "reaberto",
];
const STATUS_RESPONDER: ReadonlyArray<ChamadoInternoStatus> = ["em_analise"];
const STATUS_SOLICITAR_INFO: ReadonlyArray<ChamadoInternoStatus> = [
  "em_triagem",
  "em_analise",
];
const STATUS_RESOLVER: ReadonlyArray<ChamadoInternoStatus> = [
  "em_analise",
  "respondido",
];
const STATUS_CANCELAR: ReadonlyArray<ChamadoInternoStatus> = [
  "aberto",
  "em_triagem",
  "aguardando_solicitante",
];
const STATUS_REABRIR: ReadonlyArray<ChamadoInternoStatus> = [
  "respondido",
  "resolvido",
  "encerrado",
];
const STATUS_ENCERRADOS: ReadonlyArray<ChamadoInternoStatus> = [
  "encerrado",
  "cancelado",
];


export function getChamadoActionCapabilities(
  input: ChamadoCapabilitiesInput,
): ChamadoActionCapabilities {
  const {
    chamado,
    profileId,
    funcionarioId,
    isSuperAdmin = false,
    acessoGlobal = false,
    canAttendSetor,
    permissions,
  } = input;

  const bypassAdministrativo = canAttendSetor && (isSuperAdmin || acessoGlobal);

  // Gate operacional fail-closed: editar SEM visualizar não libera nada.
  const podeVisualizarSetor =
    bypassAdministrativo || (canAttendSetor && permissions.canVisualizarAtendimento);
  const podeOperarSetor =
    bypassAdministrativo || (podeVisualizarSetor && permissions.canEditarAtendimento);

  const status = chamado.status;
  const encerrado = STATUS_ENCERRADOS.includes(status);
  const souResponsavel =
    !!profileId && chamado.responsavel_atual_profile_id === profileId;
  const semResponsavel = chamado.responsavel_atual_profile_id === null;

  // Assumir — apenas quando NÃO há responsável (nem eu, nem outro).
  // "Assumir" é o ato de se tornar responsável; se eu já sou, o botão não deve
  // aparecer (redundante); se outro é, o backend nega (chamado_ja_atribuido).
  const canAssumir =
    podeOperarSetor && STATUS_ASSUMIR.includes(status) && semResponsavel;

  const canResponder =
    podeOperarSetor && souResponsavel && STATUS_RESPONDER.includes(status);

  const canSolicitarInformacao =
    podeOperarSetor && souResponsavel && STATUS_SOLICITAR_INFO.includes(status);

  const canAdicionarNotaInterna =
    podeOperarSetor && souResponsavel && !encerrado;

  const canResolver =
    podeOperarSetor && souResponsavel && STATUS_RESOLVER.includes(status);

  // Cancelar — fora da aba do atendente.
  const podeCancelarComoAdmin = bypassAdministrativo || permissions.canAdministrarEditar;
  const souAbridor = !!profileId && chamado.aberto_por === profileId;
  const souSolicitanteFuncionario =
    !!funcionarioId && chamado.solicitante_funcionario_id === funcionarioId;
  const podeCancelarComoSolicitante =
    permissions.canAbrirEditar && (souAbridor || souSolicitanteFuncionario);
  const canCancelar =
    (podeCancelarComoAdmin || podeCancelarComoSolicitante) &&
    STATUS_CANCELAR.includes(status);

  // Encerrar / Reabrir — atos do SOLICITANTE (ou admin), nunca do atendente.
  // Espelha `fn_chamado_interno_confirmar_encerramento` / `..._reabrir`.
  const atorDoSolicitante = podeCancelarComoAdmin || podeCancelarComoSolicitante;
  const canConfirmarEncerramento = atorDoSolicitante && status === "resolvido";
  const canReabrir =
    atorDoSolicitante && STATUS_REABRIR.includes(status);

  // Aba do atendente — só aparece quando há ação REAL de atendente disponível.
  // "Assumir" não é ação da aba: é um passo prévio, exposto como botão no
  // cabeçalho. Antes de assumir, o chamado ainda não tem responsável, então
  // nenhuma ação operacional (Responder/Nota/Solicitar/Resolver) faz sentido.
  const showAcoesAtendenteTab =
    canResponder ||
    canSolicitarInformacao ||
    canAdicionarNotaInterna ||
    canResolver;

  return {
    canAssumir,
    canResponder,
    canSolicitarInformacao,
    canAdicionarNotaInterna,
    canResolver,
    canCancelar,
    canConfirmarEncerramento,
    canReabrir,
    showAcoesAtendenteTab,
  };
}


// ---------------------------------------------------------------------------
// Tradução de erros de RPC para mensagens amigáveis.
// Nunca expõe termos técnicos ("forbidden", "SQLSTATE", códigos crus).
// ---------------------------------------------------------------------------

function toStringSafe(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function extractErr(err: unknown): ChamadosInternosError {
  if (err && typeof err === "object") {
    const e = err as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
    };
    return {
      message: toStringSafe(e.message) || "",
      code: toStringSafe(e.code) || undefined,
      details: toStringSafe(e.details) || undefined,
      hint: toStringSafe(e.hint) || undefined,
      status: typeof e.status === "number" ? e.status : undefined,
    };
  }
  return { message: typeof err === "string" ? err : "" };
}

/**
 * Extrai campos padronizados de um erro RPC/PostgREST/Fetch sem lançar,
 * preservando `code`, `message`, `details`, `hint` e `status` (HTTP).
 * Usado para instrumentação e classificação.
 */
export function getErrorField(
  err: unknown,
  field: "code" | "message" | "details" | "hint" | "status",
): string | number | undefined {
  if (!err || typeof err !== "object") {
    if (field === "message" && typeof err === "string") return err;
    return undefined;
  }
  const raw = (err as Record<string, unknown>)[field];
  if (field === "status") {
    return typeof raw === "number" ? raw : undefined;
  }
  return typeof raw === "string" ? raw : undefined;
}

export function isRpcForbidden(err: unknown): boolean {
  const e = extractErr(err);
  const blob = `${e.message} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();
  return (
    e.code === "42501" ||
    blob.includes("forbidden") ||
    blob.includes("permission denied")
  );
}

export function traduzirErroChamado(err: unknown): string {
  const e = extractErr(err);
  const blob = `${e.message} ${e.details ?? ""} ${e.hint ?? ""}`.toLowerCase();

  if (e.code === "42501" || blob.includes("forbidden") || blob.includes("permission denied")) {
    return "Você não possui autorização ou vínculo ativo para executar esta ação neste setor.";
  }
  if (blob.includes("chamado_ja_atribuido")) {
    return "Este chamado já está atribuído a outro atendente.";
  }
  if (
    blob.includes("estado_invalido_para_transicao") ||
    blob.includes("estado_invalido") ||
    blob.includes("transicao_invalida")
  ) {
    return "Este chamado não está em um estado que permite esta ação.";
  }
  if (blob.includes("mensagem_obrigatoria")) {
    return "Informe uma mensagem antes de continuar.";
  }
  return "Não foi possível concluir a ação. Tente novamente.";
}

/**
 * Tradução específica para a ação "Assumir".
 *
 * Ordem de classificação estritamente explícita — jamais usar tokens
 * genéricos ("status", "state", "transition", HTTP 400, P0001) como
 * evidência de estado inválido, para não mascarar falhas de autorização,
 * transporte, autenticação ou PostgREST.
 */
export function traduzirErroAssumir(err: unknown): string {
  const e = extractErr(err);
  const msg = e.message.toLowerCase();
  const det = (e.details ?? "").toLowerCase();
  const hnt = (e.hint ?? "").toLowerCase();
  const blob = `${msg} ${det} ${hnt}`;

  // 1) Autorização
  if (
    e.code === "42501" ||
    blob.includes("forbidden") ||
    blob.includes("permission denied")
  ) {
    return "Você não possui autorização para assumir este chamado.";
  }

  // 2) Já atribuído
  if (e.code === "55000" || blob.includes("chamado_ja_atribuido")) {
    return "Este chamado já foi assumido por outro atendente.";
  }

  // 3) Chamado inexistente
  if (e.code === "P0002" || blob.includes("chamado_inexistente")) {
    return "O chamado não foi encontrado ou não está mais disponível.";
  }

  // 4) Estado realmente inválido — somente tokens específicos.
  if (
    blob.includes("estado_invalido_para_transicao") ||
    blob.includes("estado_invalido") ||
    blob.includes("transicao_invalida")
  ) {
    return "Este chamado não está em um estado que permita ser assumido.";
  }

  // 5) Sessão/autenticação
  if (
    e.code === "28000" ||
    blob.includes("auth_required") ||
    blob.includes("jwt expired") ||
    blob.includes("jwt is expired") ||
    blob.includes("invalid jwt") ||
    blob.includes("jwt missing") ||
    blob.includes("session missing") ||
    blob.includes("session expired")
  ) {
    return "Sua sessão expirou ou não foi reconhecida. Entre novamente e tente de novo.";
  }

  // 6) Transporte/rede (sem code PostgreSQL)
  if (
    !e.code &&
    (blob.includes("failed to fetch") ||
      blob.includes("networkerror") ||
      blob.includes("network error") ||
      blob.includes("load failed") ||
      blob.includes("timeout") ||
      blob.includes("timed out") ||
      blob.includes("connection"))
  ) {
    return "Não foi possível comunicar com o servidor. Verifique sua conexão e tente novamente.";
  }

  // 7) Fallback — nunca expõe SQLSTATE/nome da RPC/mensagem bruta.
  return "Não foi possível assumir o chamado. Tente novamente.";
}
