// Edge: vincular-ccs-dispositivo
// Requer JWT humano + role SuperAdm. Nunca expor publicamente.
// Faz diff dos vínculos N:N dispositivo<->CCs. Apenas SuperAdm.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isSuper } = await admin.rpc("is_super_admin", {
      p_user_id: userId,
    });
    if (!isSuper) return json({ error: "Acesso negado" }, 403);

    const body = await req.json().catch(() => null);
    const { dispositivo_id, centro_custo_ids } = (body ?? {}) as {
      dispositivo_id?: string;
      centro_custo_ids?: string[];
    };

    if (!dispositivo_id || typeof dispositivo_id !== "string") {
      return json({ error: "dispositivo_id obrigatório" }, 400);
    }
    if (!Array.isArray(centro_custo_ids) || centro_custo_ids.length === 0) {
      return json(
        { error: "É obrigatório vincular ao menos 1 centro de custo" },
        400,
      );
    }
    if (centro_custo_ids.some((x) => typeof x !== "string")) {
      return json({ error: "centro_custo_ids inválido" }, 400);
    }
    const desired = new Set(centro_custo_ids);

    // Validar que dispositivo existe e é do tipo correto
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

    const { data: existentes, error: selErr } = await admin
      .from("bd_ponto_dispositivo_centros_custo")
      .select("id, centro_custo_id, ativo")
      .eq("dispositivo_id", dispositivo_id);
    if (selErr) return json({ error: selErr.message }, 500);

    const map = new Map<string, { id: string; ativo: boolean }>();
    (existentes ?? []).forEach((r) =>
      map.set(r.centro_custo_id as string, {
        id: r.id as string,
        ativo: r.ativo as boolean,
      })
    );

    // Reativar/inserir
    const toInsert: { dispositivo_id: string; centro_custo_id: string; criado_por: string }[] = [];
    const toReactivate: string[] = [];
    for (const cc of desired) {
      const found = map.get(cc);
      if (!found) {
        toInsert.push({
          dispositivo_id,
          centro_custo_id: cc,
          criado_por: userId,
        });
      } else if (!found.ativo) {
        toReactivate.push(found.id);
      }
    }

    // Desativar removidos
    const toDeactivate: string[] = [];
    for (const [cc, row] of map.entries()) {
      if (!desired.has(cc) && row.ativo) toDeactivate.push(row.id);
    }

    if (toInsert.length) {
      const { error } = await admin
        .from("bd_ponto_dispositivo_centros_custo")
        .insert(toInsert);
      if (error) return json({ error: error.message }, 500);
    }
    if (toReactivate.length) {
      const { error } = await admin
        .from("bd_ponto_dispositivo_centros_custo")
        .update({
          ativo: true,
          desativado_em: null,
          desativado_por: null,
        })
        .in("id", toReactivate);
      if (error) return json({ error: error.message }, 500);
    }
    if (toDeactivate.length) {
      const { error } = await admin
        .from("bd_ponto_dispositivo_centros_custo")
        .update({
          ativo: false,
          desativado_em: new Date().toISOString(),
          desativado_por: userId,
        })
        .in("id", toDeactivate);
      if (error) return json({ error: error.message }, 500);
    }

    return json({
      success: true,
      inseridos: toInsert.length,
      reativados: toReactivate.length,
      desativados: toDeactivate.length,
    });
  } catch (e) {
    console.error("vincular-ccs-dispositivo erro:", e);
    return json({ error: "Erro interno" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
