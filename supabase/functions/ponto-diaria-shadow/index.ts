// Fase 1 — Ponto × Diárias modo SHADOW.
// Execução manual (sem cron). Apenas observabilidade.
// Guard: nunca escreve em bd_diaria_presencas / bd_diaria_apontamentos.

import { z } from "https://esm.sh/zod@3.23.8";
import {
  authenticateEdgeRequest,
  authorizeBackendInvocation,
  auditBackendEvent,
  corsHeaders,
  createServiceClient,
  getClientIp,
  getRequestId,
  jsonResponse,
} from "../_shared/backend-security.ts";

const BodySchema = z.object({
  desde: z.string().min(10),
  ate: z.string().min(10),
  limit: z.number().int().min(1).max(5000).optional(),
  reprocessar: z.boolean().optional(),
});

const RECURSO = "diarias.ponto_shadow";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const admin = createServiceClient();

  const auth = await authenticateEdgeRequest(req, { allowApiKey: true });
  if (!auth) {
    await auditBackendEvent(admin, {
      auth: null, recurso: RECURSO, permitido: false, sucesso: false,
      statusHttp: 401, ip, requestId,
    });
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const authorized = await authorizeBackendInvocation(admin, auth, RECURSO);
  if (!authorized) {
    await auditBackendEvent(admin, {
      auth, recurso: RECURSO, permitido: false, sucesso: false,
      statusHttp: 403, ip, requestId,
    });
    return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    return jsonResponse({ error: "invalid body", detail: String(err) }, 400);
  }

  try {
    let deleted = 0;
    if (body.reprocessar === true) {
      // GUARD DURO: apaga somente registros shadow (presenca_diaria_id IS NULL).
      const { count, error: delErr } = await admin
        .from("bd_ponto_diaria_integracao")
        .delete({ count: "exact" })
        .is("presenca_diaria_id", null)
        .gte("data_operacional", body.desde.slice(0, 10))
        .lte("data_operacional", body.ate.slice(0, 10));
      if (delErr) throw delErr;
      deleted = count ?? 0;
    }

    const { data, error } = await admin.rpc("fn_ponto_diaria_simular_lote", {
      p_desde: body.desde,
      p_ate: body.ate,
      p_limit: body.limit ?? 500,
    });
    if (error) throw error;

    await auditBackendEvent(admin, {
      auth, recurso: RECURSO, acao: body.reprocessar ? "reprocessar" : "simular",
      nivelRisco: "baixo", permitido: true, sucesso: true,
      statusHttp: 200, ip, requestId,
      payloadResumo: { desde: body.desde, ate: body.ate, limit: body.limit ?? 500, reprocessar: !!body.reprocessar },
      resultadoResumo: { ...(data as Record<string, unknown> ?? {}), deleted },
    });

    return jsonResponse({ ok: true, deleted, resultado: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await auditBackendEvent(admin, {
      auth, recurso: RECURSO, permitido: true, sucesso: false,
      statusHttp: 500, ip, requestId, erroResumo: msg,
    });
    return jsonResponse({ error: "internal", detail: msg }, 500);
  }
});
