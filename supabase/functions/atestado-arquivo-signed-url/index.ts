// Edge: atestado-arquivo-signed-url
// Autenticada (valida JWT em código). Retorna signed URL de 5 min para download,
// somente para SuperAdm ou quem tem saude_atestados_download.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, jsonResponse } from "../_shared/atestados-cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "atestados-medicos";
const TTL_SEG = 300;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors.headers });
  }
  if (cors.blocked) {
    return new Response("forbidden", { status: 403, headers: cors.headers });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const token = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth
    .getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: isSA } = await admin.rpc("has_role", {
    p_role: "SuperAdm",
    p_user_id: userId,
  });
  const { data: canDownload } = await admin.rpc("has_permission", {
    p_permission_name: "saude_atestados_download",
    p_user_id: userId,
  });
  if (!isSA && !canDownload) {
    return jsonResponse({ error: "forbidden" }, 403, cors);
  }

  let body: { atestado_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }
  const atestadoId = String(body.atestado_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(atestadoId)) {
    return jsonResponse({ error: "invalid_input" }, 400, cors);
  }

  const { data: atm, error: atmErr } = await admin
    .from("bd_atestados_medicos")
    .select("id, arquivo_path, protocolo")
    .eq("id", atestadoId)
    .maybeSingle();
  if (atmErr || !atm) {
    return jsonResponse({ error: "nao_encontrado" }, 404, cors);
  }

  const { data: signed, error: sErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(atm.arquivo_path, TTL_SEG);
  if (sErr || !signed) {
    return jsonResponse({ error: "signed_url_failed" }, 500, cors);
  }

  try {
    await admin.from("bd_auditoria_log").insert({
      tabela: "bd_atestados_medicos",
      operacao: "DOWNLOAD",
      registro_id: String(atm.id),
      usuario_id: userId,
      dados_novos: {
        protocolo: atm.protocolo,
        ttl_seg: TTL_SEG,
        arquivo_path: atm.arquivo_path,
        acao: "signed_url_gerada",
      },
      campos_alterados: ["arquivo_path"],
    });
  } catch (e) {
    console.error("[atestado-arquivo-signed-url] auditoria falhou", e);
  }

  return jsonResponse({
    ok: true,
    signed_url: signed.signedUrl,
    expira_em_segundos: TTL_SEG,
  }, 200, cors);
});
