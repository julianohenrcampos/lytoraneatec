// Edge: pop-upload-arquivo
// Recebe multipart (pop_id + file PDF), valida integralmente, envia ao bucket
// privado pops-documentos e grava os metadados no rascunho via RPC exclusiva
// de service_role. Em falha da RPC, remove o objeto recém-criado.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsFor,
  hasPdfMagicBytes,
  isUuid,
  jsonResponse,
  POPS_BUCKET,
  POPS_MAX_BYTES,
  sha256Hex,
} from "../_shared/pops-cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (cors.blocked) return new Response("forbidden", { status: 403, headers: cors.headers });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return jsonResponse({ error: "unauthorized" }, 401, cors);
  const token = auth.slice(7);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Gate de disponibilidade do módulo (ator resolvido pelo JWT, nunca pelo body)
  const { data: gateOk, error: gateErr } = await admin.rpc("fn_pop_gate_homologacao_ator", {
    p_ator: userId,
  });
  if (gateErr || gateOk !== true) return jsonResponse({ error: "modulo_indisponivel" }, 403, cors);

  const [{ data: canCriar }, { data: canEditar }] = await Promise.all([
    admin.rpc("user_has_permission_action", { _user_id: userId, _codigo: "pops_view", _acao: "criar" }),
    admin.rpc("user_has_permission_action", { _user_id: userId, _codigo: "pops_view", _acao: "editar" }),
  ]);
  if (canCriar !== true && canEditar !== true) {
    return jsonResponse({ error: "forbidden" }, 403, cors);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "invalid_multipart" }, 400, cors);
  }

  const popId = String(form.get("pop_id") || "");
  if (!isUuid(popId)) return jsonResponse({ error: "invalid_pop_id" }, 400, cors);

  const file = form.get("file");
  if (!(file instanceof File)) return jsonResponse({ error: "arquivo_ausente" }, 400, cors);

  const nomeOriginal = (file.name || "").trim();
  if (nomeOriginal.length < 1 || nomeOriginal.length > 255 || /[\u0000-\u001f\u007f]/.test(nomeOriginal)) {
    return jsonResponse({ error: "nome_arquivo_invalido" }, 400, cors);
  }
  if (!nomeOriginal.toLowerCase().endsWith(".pdf")) {
    return jsonResponse({ error: "extensao_invalida" }, 400, cors);
  }
  if (file.type && file.type !== "application/pdf") {
    return jsonResponse({ error: "mime_invalido" }, 415, cors);
  }
  if (file.size < 1 || file.size > POPS_MAX_BYTES) {
    return jsonResponse({ error: "tamanho_invalido" }, 413, cors);
  }

  const buf = await file.arrayBuffer();
  if (buf.byteLength < 1 || buf.byteLength > POPS_MAX_BYTES) {
    return jsonResponse({ error: "tamanho_invalido" }, 413, cors);
  }
  if (!hasPdfMagicBytes(buf)) return jsonResponse({ error: "conteudo_nao_pdf" }, 415, cors);

  const sha = await sha256Hex(buf);
  const path = `${popId}/${sha}.pdf`;

  // upload sem upsert; objeto já existente com o mesmo SHA-256 é idempotente
  let uploadedNow = false;
  const { error: upErr } = await admin.storage.from(POPS_BUCKET).upload(path, buf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) {
    const msg = String(upErr.message || "").toLowerCase();
    const alreadyExists = msg.includes("exists") || msg.includes("duplicate");
    if (!alreadyExists) {
      console.error("[pop-upload-arquivo] upload falhou", upErr.message);
      return jsonResponse({ error: "storage_upload_failed" }, 500, cors);
    }
  } else {
    uploadedNow = true;
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc("fn_pop_anexar_arquivo_rascunho", {
    p_ator: userId,
    p_pop_id: popId,
    p_path: path,
    p_nome_original: nomeOriginal,
    p_mime: "application/pdf",
    p_tamanho: buf.byteLength,
    p_sha256: sha,
  });

  if (rpcErr) {
    if (uploadedNow) {
      await admin.storage.from(POPS_BUCKET).remove([path]).catch(() => undefined);
    }
    console.error("[pop-upload-arquivo] rpc falhou", rpcErr.message);
    return jsonResponse({ error: "rpc_failed", detail: rpcErr.message }, 400, cors);
  }

  const anterior = (rpcData as Record<string, unknown> | null)?.arquivo_path_anterior as
    | string
    | null
    | undefined;

  if (anterior && anterior !== path) {
    const { error: rmErr } = await admin.storage.from(POPS_BUCKET).remove([anterior]);
    if (rmErr) {
      await admin.from("bd_auditoria_log").insert({
        tabela: "bd_pop_rascunhos",
        operacao: "UPDATE",
        registro_id: popId,
        usuario_id: userId,
        dados_novos: {
          acao: "pop_arquivo_remocao_pendente",
          arquivo_path: anterior,
          via: "pop-upload-arquivo",
        },
        campos_alterados: ["arquivo_path"],
      });
    }
  }

  return jsonResponse(
    { ok: true, pop_id: popId, arquivo_path: path, arquivo_sha256: sha, idempotente: !uploadedNow },
    200,
    cors,
  );
});
