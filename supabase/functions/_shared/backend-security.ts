import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface EdgeAuthContext {
  mode: "jwt" | "api_key";
  userId: string | null;
  email: string | null;
  subject: string | null;
  token: string | null;
}

interface AuthenticateOptions {
  allowApiKey?: boolean;
  apiKeySecretNames?: string[];
}

interface AuditEventInput {
  auth: EdgeAuthContext | null;
  recurso: string;
  contexto?: string | null;
  acao?: string;
  nivelRisco?: "baixo" | "medio" | "alto" | "critico";
  permitido: boolean;
  sucesso: boolean;
  statusHttp?: number | null;
  ip?: string | null;
  requestId?: string | null;
  payloadResumo?: Record<string, unknown>;
  resultadoResumo?: Record<string, unknown>;
  erroResumo?: string | null;
  backendTipo?: "edge_function" | "rpc" | "api_interna";
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

export function getClientIp(req: Request): string | null {
  const candidates = [
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip"),
    req.headers.get("cf-connecting-ip"),
  ];

  const value = candidates.find(Boolean)?.split(",")[0]?.trim() ?? null;
  if (!value) return null;

  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
  const isIPv6 = /^[a-f0-9:]+$/i.test(value);
  return isIPv4 || isIPv6 ? value : null;
}

export async function authenticateEdgeRequest(
  req: Request,
  options: AuthenticateOptions = {},
): Promise<EdgeAuthContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createUserClient(authHeader);
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await userClient.auth.getClaims(token);

    if (error || !data?.claims?.sub) {
      return null;
    }

    return {
      mode: "jwt",
      userId: String(data.claims.sub),
      email: typeof data.claims.email === "string" ? data.claims.email : null,
      subject: String(data.claims.sub),
      token,
    };
  }

  if (options.allowApiKey) {
    const apiKey = req.headers.get("x-api-key");
    const secretNames = options.apiKeySecretNames ?? ["LYTOTEC_API_KEY"];
    const isValid = !!apiKey && secretNames.some((name) => {
      const expected = Deno.env.get(name);
      return !!expected && expected === apiKey;
    });

    if (isValid) {
      return {
        mode: "api_key",
        userId: null,
        email: null,
        subject: "api-key",
        token: null,
      };
    }
  }

  return null;
}

export async function authorizeBackendInvocation(
  supabaseAdmin: SupabaseClient,
  auth: EdgeAuthContext,
  recurso: string,
  contexto?: string | null,
): Promise<boolean> {
  if (auth.mode === "api_key") return true;
  if (!auth.userId) return false;

  const { data, error } = await supabaseAdmin.rpc("fn_backend_can_invoke", {
    p_user_id: auth.userId,
    p_resource: recurso,
    p_context: contexto ?? null,
  });

  if (error) {
    console.error(`[${recurso}] erro ao autorizar`, error);
    return false;
  }

  return data === true;
}

export async function auditBackendEvent(
  supabaseAdmin: SupabaseClient,
  input: AuditEventInput,
): Promise<void> {
  try {
    await supabaseAdmin.rpc("fn_backend_audit_event", {
      p_actor_user_id: input.auth?.userId ?? null,
      p_auth_subject: input.auth?.subject ?? null,
      p_auth_email: input.auth?.email ?? null,
      p_auth_mode: input.auth?.mode ?? "anonymous",
      p_backend_tipo: input.backendTipo ?? "edge_function",
      p_recurso: input.recurso,
      p_contexto: input.contexto ?? null,
      p_acao: input.acao ?? "execute",
      p_nivel_risco: input.nivelRisco ?? "medio",
      p_permitido: input.permitido,
      p_sucesso: input.sucesso,
      p_status_http: input.statusHttp ?? null,
      p_origem_ip: input.ip ?? null,
      p_request_id: input.requestId ?? null,
      p_payload_resumo: input.payloadResumo ?? {},
      p_resultado_resumo: input.resultadoResumo ?? {},
      p_erro_resumo: input.erroResumo ?? null,
    });
  } catch (error) {
    console.error(`[${input.recurso}] falha ao auditar`, error);
  }
}