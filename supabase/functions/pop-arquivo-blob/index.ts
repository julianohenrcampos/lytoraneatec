// Edge: pop-arquivo-blob
// Entrega o PDF do POP (vigente ou em preparação) como binário inline.
// Nenhuma signed URL é exposta; o download é feito pelo service_role.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsFor,
  hasPdfMagicBytes,
  isUuid,
  jsonResponse,
  POPS_BUCKET,
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

  const { data: gateOk, error: gateErr } = await admin.rpc("fn_pop_gate_homologacao_ator", {
    p_ator: userId,
  });
  if (gateErr || gateOk !== true) return jsonResponse({ error: "modulo_indisponivel" }, 403, cors);

  let body: { pop_id?: string; origem?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }
  const popId = String(body.pop_id || "");
  const origem = body.origem === "rascunho" ? "rascunho" : "vigente";
  if (!isUuid(popId)) return jsonResponse({ error: "invalid_pop_id" }, 400, cors);

  const [{ data: canVisualizar }, { data: canEditar }, { data: canAprovar }] = await Promise.all([
    admin.rpc("user_has_permission_action", { _user_id: userId, _codigo: "pops_view", _acao: "visualizar" }),
    admin.rpc("user_has_permission_action", { _user_id: userId, _codigo: "pops_view", _acao: "editar" }),
    admin.rpc("user_has_permission_action", { _user_id: userId, _codigo: "pops_view", _acao: "aprovar" }),
  ]);

  const isGestor = canEditar === true || canAprovar === true;
  if (canVisualizar !== true && !isGestor) return jsonResponse({ error: "forbidden" }, 403, cors);

  let path: string | null = null;
  let nome = "pop.pdf";
  let registroId = popId;

  if (origem === "rascunho") {
    if (!isGestor) return jsonResponse({ error: "forbidden" }, 403, cors);
    const { data: r } = await admin
      .from("bd_pop_rascunhos")
      .select("id, arquivo_path, arquivo_nome_original")
      .eq("pop_id", popId)
      .maybeSingle();
    if (!r?.arquivo_path) return jsonResponse({ error: "nao_encontrado" }, 404, cors);
    path = r.arquivo_path;
    nome = r.arquivo_nome_original || nome;
    registroId = r.id;
  } else {
    const { data: pop } = await admin
      .from("bd_pops")
      .select("id, status, arquivo_path, arquivo_nome_original")
      .eq("id", popId)
      .maybeSingle();
    if (!pop?.arquivo_path) return jsonResponse({ error: "nao_encontrado" }, 404, cors);
    // Quem só tem 'visualizar' acessa exclusivamente POP ativo
    if (!isGestor && pop.status !== "ativo") return jsonResponse({ error: "forbidden" }, 403, cors);
    path = pop.arquivo_path;
    nome = pop.arquivo_nome_original || nome;
  }

  const { data: blob, error: dlErr } = await admin.storage.from(POPS_BUCKET).download(path!);
  if (dlErr || !blob) return jsonResponse({ error: "storage_download_failed" }, 500, cors);

  const buf = await blob.arrayBuffer();
  if (!hasPdfMagicBytes(buf)) return jsonResponse({ error: "unsupported_media" }, 415, cors);

  try {
    await admin.from("bd_auditoria_log").insert({
      tabela: origem === "rascunho" ? "bd_pop_rascunhos" : "bd_pops",
      operacao: "DOWNLOAD",
      registro_id: registroId,
      usuario_id: userId,
      dados_novos: {
        acao: "pop_visualizar_arquivo",
        pop_id: popId,
        origem,
        arquivo_path: path,
        via: "pop-arquivo-blob",
      },
      campos_alterados: ["arquivo_path"],
    });
  } catch (_e) {
    console.error("[pop-arquivo-blob] auditoria falhou");
  }

  const safeName = nome.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return new Response(buf, {
    status: 200,
    headers: {
      ...cors.headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
