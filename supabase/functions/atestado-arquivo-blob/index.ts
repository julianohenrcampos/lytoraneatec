// Edge: atestado-arquivo-blob
// Retorna o arquivo do atestado como binário puro, com CORS próprio.
// Frontend recebe Blob direto e monta objectUrl local — evita CORS do Storage.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor } from "../_shared/atestados-cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "atestados-medicos";

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function sanitizeProtocolo(p: string): string {
  return (p || "arquivo").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors.headers });
  }
  if (cors.blocked) {
    return new Response("forbidden", { status: 403, headers: cors.headers });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors.headers);
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, cors.headers);
  }
  const token = auth.slice(7);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return jsonResponse({ error: "unauthorized" }, 401, cors.headers);
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
    return jsonResponse({ error: "forbidden" }, 403, cors.headers);
  }

  let body: { atestado_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors.headers);
  }
  const atestadoId = String(body.atestado_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(atestadoId)) {
    return jsonResponse({ error: "invalid_input" }, 400, cors.headers);
  }

  const { data: atm, error: atmErr } = await admin
    .from("bd_atestados_medicos")
    .select("id, arquivo_path, protocolo")
    .eq("id", atestadoId)
    .maybeSingle();
  if (atmErr || !atm) {
    return jsonResponse({ error: "nao_encontrado" }, 404, cors.headers);
  }

  const { data: fileBlob, error: dlErr } = await admin.storage
    .from(BUCKET)
    .download(atm.arquivo_path);
  if (dlErr || !fileBlob) {
    return jsonResponse({ error: "storage_download_failed" }, 500, cors.headers);
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const head = new Uint8Array(arrayBuffer.slice(0, 8));
  let mime: string;
  let ext: string;
  if (
    head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  ) {
    mime = "application/pdf";
    ext = "pdf";
  } else if (
    head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
  ) {
    mime = "image/png";
    ext = "png";
  } else if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    mime = "image/jpeg";
    ext = "jpg";
  } else {
    return jsonResponse({ error: "unsupported_media" }, 415, cors.headers);
  }

  try {
    await admin.from("bd_auditoria_log").insert({
      tabela: "bd_atestados_medicos",
      operacao: "DOWNLOAD",
      registro_id: String(atm.id),
      usuario_id: userId,
      dados_novos: {
        protocolo: atm.protocolo,
        via: "atestado-arquivo-blob",
        mime,
        acao: "arquivo_binario_entregue",
      },
      campos_alterados: ["arquivo_path"],
    });
  } catch (_e) {
    console.error("[atestado-arquivo-blob] auditoria falhou");
  }

  const filename = `atestado-${sanitizeProtocolo(atm.protocolo)}.${ext}`;
  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      ...cors.headers,
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
