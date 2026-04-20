// Edge: definir-senha-dispositivo
// Requer JWT humano + role SuperAdm. Nunca expor publicamente.
// Define/reseta a senha (bcrypt) de um dispositivo de ponto. Apenas SuperAdm.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hash as bcryptHash } from "https://esm.sh/bcrypt-ts@5.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth
      .getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Token inválido" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // SuperAdm check
    const { data: isSuper } = await admin.rpc("is_super_admin", {
      p_user_id: userId,
    });
    if (!isSuper) {
      return json({ error: "Acesso negado" }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Payload inválido" }, 400);
    }
    const { dispositivo_id, senha } = body as {
      dispositivo_id?: string;
      senha?: string;
    };
    if (!dispositivo_id || typeof dispositivo_id !== "string") {
      return json({ error: "dispositivo_id obrigatório" }, 400);
    }
    if (!senha || typeof senha !== "string" || senha.length < 8) {
      return json({ error: "Senha deve ter pelo menos 8 caracteres" }, 400);
    }
    if (senha.length > 128) {
      return json({ error: "Senha muito longa" }, 400);
    }

    const { data: disp, error: dispErr } = await admin
      .from("bd_ponto_dispositivos")
      .select("id, tipo")
      .eq("id", dispositivo_id)
      .maybeSingle();
    if (dispErr) return json({ error: dispErr.message }, 500);
    if (!disp) return json({ error: "Dispositivo não encontrado" }, 404);
    if (disp.tipo !== "dispositivo_obra") {
      return json(
        { error: "Operação válida apenas para dispositivos de obra" },
        400,
      );
    }

    // bcrypt-ts: pure TS, no Worker dependency (compatível com runtime atual das Edge Functions)
    const hash = await bcryptHash(senha, 10);

    const { error: updErr } = await admin
      .from("bd_ponto_dispositivos")
      .update({ senha_hash: hash, updated_at: new Date().toISOString() })
      .eq("id", dispositivo_id)
      .eq("tipo", "dispositivo_obra");
    if (updErr) return json({ error: updErr.message }, 500);

    console.log("[PONTO] Senha definida para dispositivo:", dispositivo_id);
    return json({ success: true });
  } catch (e) {
    console.error("definir-senha-dispositivo erro:", e);
    return json({ error: (e as Error)?.message ?? "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
