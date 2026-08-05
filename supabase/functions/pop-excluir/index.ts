// Edge: pop-excluir
// Exclusão definitiva de um POP (vigente + rascunho). A autorização real ocorre
// na RPC fn_pop_excluir com o JWT do usuário; a remoção física dos PDFs no
// bucket privado acontece somente após o commit, com service_role.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsFor, isUuid, jsonResponse, POPS_BUCKET } from "../_shared/pops-cors.ts";

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

  let body: { pop_id?: string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }
  const popId = String(body.pop_id || "");
  const motivo = String(body.motivo || "").trim();
  if (!isUuid(popId)) return jsonResponse({ error: "invalid_pop_id" }, 400, cors);
  if (motivo.length < 10) return jsonResponse({ error: "motivo_obrigatorio" }, 400, cors);

  const { data, error } = await userClient.rpc("fn_pop_excluir", {
    p_pop_id: popId,
    p_motivo: motivo,
  });
  if (error) {
    return jsonResponse({ error: "rpc_failed", detail: error.message }, 400, cors);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  const paths = Array.isArray(result.arquivos_removidos)
    ? (result.arquivos_removidos as string[]).filter((p) => typeof p === "string" && p.length > 0)
    : [];

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from(POPS_BUCKET).remove(paths);
    if (rmErr) {
      // A exclusão do registro permanece efetivada; registra a pendência de limpeza.
      await admin.from("bd_auditoria_log").insert({
        tabela: "bd_pops",
        operacao: "DELETE",
        registro_id: popId,
        usuario_id: userId,
        dados_novos: {
          acao: "pop_arquivo_remocao_pendente",
          arquivos: paths,
          via: "pop-excluir",
        },
        campos_alterados: ["arquivo_path"],
      });
    }
  }

  return jsonResponse(
    { ok: true, pop_id: popId, codigo: result.codigo ?? null, arquivos_removidos: paths },
    200,
    cors,
  );
});
