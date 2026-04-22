import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  auditBackendEvent,
  authenticateEdgeRequest,
  authorizeBackendInvocation,
  corsHeaders,
  createServiceClient,
  getClientIp,
  getRequestId,
  jsonResponse,
} from "../_shared/backend-security.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const supabase = createServiceClient();
  const auth = await authenticateEdgeRequest(req, { allowApiKey: true, apiKeySecretNames: ["LYTOTEC_API_KEY"] });

  if (!auth) {
    await auditBackendEvent(supabase, {
      auth: null,
      recurso: "process-desligamentos",
      contexto: "rh_desligamentos",
      nivelRisco: "critico",
      permitido: false,
      sucesso: false,
      statusHttp: 401,
      ip,
      requestId,
      erroResumo: "nao_autenticado",
    });
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  try {
    const allowed = await authorizeBackendInvocation(supabase, auth, "process-desligamentos", "rh_desligamentos");
    if (!allowed) {
      await auditBackendEvent(supabase, {
        auth,
        recurso: "process-desligamentos",
        contexto: "rh_desligamentos",
        nivelRisco: "critico",
        permitido: false,
        sucesso: false,
        statusHttp: 403,
        ip,
        requestId,
        erroResumo: "sem_permissao",
      });
      return jsonResponse({ error: "Sem permissão para processar desligamentos" }, 403);
    }

    const hoje = new Date().toISOString().split("T")[0];

    // Buscar desligamentos em andamento com aviso prévio vencido
    const { data: pendentes, error: errSelect } = await supabase
      .from("bd_desligamentos")
      .select("id, funcionario_id, data_fim_aviso")
      .eq("status", "em_andamento")
      .lte("data_fim_aviso", hoje);

    if (errSelect) throw errSelect;
    if (!pendentes || pendentes.length === 0) {
      await auditBackendEvent(supabase, {
        auth,
        recurso: "process-desligamentos",
        contexto: "rh_desligamentos",
        nivelRisco: "critico",
        permitido: true,
        sucesso: true,
        statusHttp: 200,
        ip,
        requestId,
        resultadoResumo: { processados: 0 },
      });
      return jsonResponse({ message: "Nenhum desligamento para processar" });
    }

    let processados = 0;
    for (const d of pendentes) {
      // Inativar funcionário
      await supabase
        .from("bd_funcionarios")
        .update({ status: "Inativo", data_desligamento: hoje })
        .eq("id", d.funcionario_id);

      // Concluir desligamento
      await supabase
        .from("bd_desligamentos")
        .update({ status: "concluido" })
        .eq("id", d.id);

      processados++;
    }

    await auditBackendEvent(supabase, {
      auth,
      recurso: "process-desligamentos",
      contexto: "rh_desligamentos",
      nivelRisco: "critico",
      permitido: true,
      sucesso: true,
      statusHttp: 200,
      ip,
      requestId,
      resultadoResumo: { processados },
    });

    return jsonResponse({ message: `Processados: ${processados} desligamentos` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    await auditBackendEvent(supabase, {
      auth,
      recurso: "process-desligamentos",
      contexto: "rh_desligamentos",
      nivelRisco: "critico",
      permitido: true,
      sucesso: false,
      statusHttp: 500,
      ip,
      requestId,
      erroResumo: message,
    });
    return jsonResponse({ error: message }, 500);
  }
});
