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
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const supabaseAdmin = createServiceClient();
  const auth = await authenticateEdgeRequest(req, { allowApiKey: true, apiKeySecretNames: ["LYTOTEC_API_KEY"] });

  if (!auth) {
    await auditBackendEvent(supabaseAdmin, {
      auth: null,
      recurso: "sync-subcategorias-site",
      contexto: "catalogo_ativos",
      nivelRisco: "alto",
      permitido: false,
      sucesso: false,
      statusHttp: 401,
      ip,
      requestId,
      erroResumo: "nao_autenticado",
    });
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const allowed = await authorizeBackendInvocation(supabaseAdmin, auth, "sync-subcategorias-site", "catalogo_ativos");
    if (!allowed) {
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: "sync-subcategorias-site",
        contexto: "catalogo_ativos",
        nivelRisco: "alto",
        permitido: false,
        sucesso: false,
        statusHttp: 403,
        ip,
        requestId,
        erroResumo: "sem_permissao",
      });
      return jsonResponse({ error: "Sem permissão para sincronizar subcategorias" }, 403);
    }

    const { data: subcategorias, error: dbError } = await supabaseAdmin
      .from("bd_subcategorias_ativos")
      .select("nome_subcategoria, categoria:bd_categorias_ativos(nome_categoria)")
      .eq("ativo", true);

    if (dbError) {
      return jsonResponse({ error: `Erro ao buscar subcategorias: ${dbError.message}` }, 500);
    }

    if (!subcategorias || subcategorias.length === 0) {
      return jsonResponse({ processados: 0, total: 0 });
    }

    const payload = subcategorias.map((s: any) => ({
      nome: s.nome_subcategoria,
      categoria: s.categoria?.nome_categoria || null,
    }));

    // Call SITE API
    const apiKey = Deno.env.get("LYTOTEC_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "LYTOTEC_API_KEY não configurada" }, 500);
    }

    const siteResponse = await fetch(
      "https://vitxtbotmtxfytusptbf.supabase.co/functions/v1/subcategorias-sync",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ subcategorias: payload }),
      }
    );

    const responseText = await siteResponse.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { error: `SITE retornou: ${responseText}`, status: siteResponse.status };
    }

    if (!siteResponse.ok) {
      await auditBackendEvent(supabaseAdmin, {
        auth,
        recurso: "sync-subcategorias-site",
        contexto: "catalogo_ativos",
        nivelRisco: "alto",
        permitido: true,
        sucesso: false,
        statusHttp: siteResponse.status,
        ip,
        requestId,
        payloadResumo: { total: payload.length },
        erroResumo: typeof result?.error === "string" ? result.error : "erro_sync_destino",
      });
      return jsonResponse(result, siteResponse.status);
    }

    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: "sync-subcategorias-site",
      contexto: "catalogo_ativos",
      nivelRisco: "alto",
      permitido: true,
      sucesso: true,
      statusHttp: 200,
      ip,
      requestId,
      payloadResumo: { total: payload.length },
      resultadoResumo: { total: payload.length },
    });
    return jsonResponse(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    await auditBackendEvent(supabaseAdmin, {
      auth,
      recurso: "sync-subcategorias-site",
      contexto: "catalogo_ativos",
      nivelRisco: "alto",
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
