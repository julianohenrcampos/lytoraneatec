// Edge: atestado-criar-upload-url
// Público (verify_jwt=false). Valida HMAC (não consome nonce) e devolve signed upload URL
// para o bucket privado "atestados-medicos".

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, jsonResponse } from "../_shared/atestados-cors.ts";
import { verifyToken } from "../_shared/atestados-hmac.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("ATESTADO_HMAC_SECRET")!;
const BUCKET = "atestados-medicos";
const EXT_PERMITIDAS = new Set(["pdf", "jpg", "jpeg", "png"]);

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

  let body: { token_validacao?: string; extensao?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const token = String(body.token_validacao || "");
  const extRaw = String(body.extensao || "").toLowerCase().replace(/^\./, "");
  if (!token || !EXT_PERMITIDAS.has(extRaw)) {
    return jsonResponse({ error: "invalid_input" }, 400, cors);
  }

  const claims = await verifyToken(token, HMAC_SECRET);
  if (!claims) return jsonResponse({ error: "token_invalido" }, 401, cors);

  const ext = extRaw === "jpeg" ? "jpg" : extRaw;
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const dir = crypto.randomUUID();
  const file = crypto.randomUUID();
  const path = `${yyyy}/${mm}/${dir}/${file}.${ext}`;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return jsonResponse({ error: "upload_url_failed" }, 500, cors);
  }

  return jsonResponse({
    ok: true,
    signed_url: data.signedUrl,
    token: data.token,
    arquivo_path: path, // path INTERNO do bucket (sem prefixo do bucket)
    bucket: BUCKET,
  }, 200, cors);
});
