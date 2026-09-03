import {
  auditBackendEvent,
  authenticateEdgeRequest,
  corsHeaders,
  createServiceClient,
  getClientIp,
  getRequestId,
  jsonResponse,
} from "../_shared/backend-security.ts";

const EDITAVEIS = new Set(["RASCUNHO", "PENDENTE_APROVACAO"]);

async function hasAnyRow(supabaseAdmin: ReturnType<typeof createServiceClient>, table: string, solicitacaoId: string) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("solicitacao_id", solicitacaoId)
    .limit(1);

  if (error) {
    console.warn(`[excluir-solicitacao-equipamento] ${table} indisponível:`, error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const supabaseAdmin = createServiceClient();
  const auth = await authenticateEdgeRequest(req);

  if (!auth?.userId) {
    return jsonResponse({ success: false, error: "Usuário não autenticado." }, 401);
  }

  try {
    const { id } = await req.json();
    if (!id || typeof id !== "string") {
      return jsonResponse({ success: false, error: "ID da solicitação é obrigatório." }, 400);
    }

    const { data: solicitacao, error: selectError } = await supabaseAdmin
      .from("bd_solicitacoes_equipamento")
      .select("id, solicitante_id, status_fluxo")
      .eq("id", id)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!solicitacao) {
      return jsonResponse({ success: false, error: "Solicitação não encontrada." }, 404);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("funcoes, funcao_sistema, acesso_global")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profileError) throw profileError;

    const funcoes = Array.isArray(profile?.funcoes) ? profile.funcoes : [];
    const isSuperAdmin =
      profile?.acesso_global === true &&
      (funcoes.includes("SuperAdm") || profile?.funcao_sistema === "SuperAdm");

    const status = String(solicitacao.status_fluxo || "");
    const isSolicitanteEditavel = solicitacao.solicitante_id === auth.userId && EDITAVEIS.has(status);
    const permitido = isSuperAdmin || isSolicitanteEditavel;

    if (!permitido) {
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: "excluir-solicitacao-equipamento",
        contexto: "solicitacoes_equipamento",
        acao: "delete",
        nivelRisco: "alto",
        permitido: false,
        sucesso: false,
        statusHttp: 403,
        ip,
        requestId,
        payloadResumo: { id, status },
        erroResumo: "sem_permissao",
      });
      return jsonResponse({ success: false, error: "Sem permissão para excluir esta solicitação." }, 403);
    }

    const [movimentacoes, cotacoes, planejamento] = await Promise.all([
      hasAnyRow(supabaseAdmin, "bd_movimentacoes", id),
      hasAnyRow(supabaseAdmin, "bd_cotacoes", id),
      hasAnyRow(supabaseAdmin, "bd_solicitacoes_planejamento", id),
    ]);

    if (movimentacoes || cotacoes || planejamento) {
      return jsonResponse(
        {
          success: false,
          error: "Esta solicitação já possui histórico operacional e não pode ser excluída. Use Cancelar.",
          detalhes: { movimentacoes, cotacoes, planejamento },
        },
        409,
      );
    }

    const childTables = ["bd_solicitacoes_equip_aprovacoes", "bd_solicitacoes_itens"];
    for (const table of childTables) {
      const { error } = await supabaseAdmin.from(table).delete().eq("solicitacao_id", id);
      if (error) throw error;
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from("bd_solicitacoes_equipamento")
      .delete({ count: "exact" })
      .eq("id", id);

    if (deleteError) throw deleteError;
    if ((count ?? 0) < 1) {
      return jsonResponse({ success: false, error: "A solicitação não foi excluída." }, 409);
    }

    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: "excluir-solicitacao-equipamento",
      contexto: "solicitacoes_equipamento",
      acao: "delete",
      nivelRisco: "alto",
      permitido: true,
      sucesso: true,
      statusHttp: 200,
      ip,
      requestId,
      payloadResumo: { id, status },
      resultadoResumo: { id, count },
    });

    return jsonResponse({ success: true, id, count: count ?? 1 }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao excluir solicitação.";
    console.error("[excluir-solicitacao-equipamento] erro:", error);
    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: "excluir-solicitacao-equipamento",
      contexto: "solicitacoes_equipamento",
      acao: "delete",
      nivelRisco: "alto",
      permitido: true,
      sucesso: false,
      statusHttp: 500,
      ip,
      requestId,
      erroResumo: message,
    });
    return jsonResponse({ success: false, error: message }, 500);
  }
});