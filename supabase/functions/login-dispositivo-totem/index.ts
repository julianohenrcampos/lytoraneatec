import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compare as bcryptCompare } from "https://esm.sh/bcrypt-ts@5.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Método não permitido" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const codigo_dispositivo = String(body?.codigo_dispositivo || "")
      .trim()
      .toUpperCase();
    const senha = String(body?.senha || "");

    if (!codigo_dispositivo || !senha) {
      return json(
        { success: false, error: "Código e senha são obrigatórios" },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: disp, error: dispErr } = await supabase
      .from("bd_ponto_dispositivos")
      .select(
        "id, nome, codigo_dispositivo, centro_custo_id, ativo, tipo, senha_hash",
      )
      .eq("codigo_dispositivo", codigo_dispositivo)
      .maybeSingle();

    if (dispErr) {
      console.error("[PONTO][TOTEM_LOGIN] db error:", dispErr);
      return json({ success: false, error: "Erro interno" }, 500);
    }

    if (!disp || disp.tipo !== "dispositivo_obra" || !disp.ativo) {
      console.log(
        `[PONTO][TOTEM_LOGIN] codigo=${codigo_dispositivo} not_found_or_inactive`,
      );
      return json(
        { success: false, error: "Código ou senha inválidos" },
        401,
      );
    }

    if (!disp.senha_hash) {
      console.log(
        `[PONTO][TOTEM_LOGIN] codigo=${codigo_dispositivo} sem senha definida`,
      );
      return json(
        {
          success: false,
          error: "Dispositivo sem senha definida. Procure o administrador.",
        },
        401,
      );
    }

    const ok = await bcryptCompare(senha, disp.senha_hash);
    if (!ok) {
      console.log(
        `[PONTO][TOTEM_LOGIN] codigo=${codigo_dispositivo} senha_invalida`,
      );
      return json(
        { success: false, error: "Código ou senha inválidos" },
        401,
      );
    }

    const device_secret = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const { error: updErr } = await supabase
      .from("bd_ponto_dispositivos")
      .update({
        device_session_token: device_secret,
        device_session_expires_at: expires,
        ultimo_login_at: new Date().toISOString(),
        ultimo_login_ip: ip,
      })
      .eq("id", disp.id);

    if (updErr) {
      console.error("[PONTO][TOTEM_LOGIN] update session error:", updErr);
      return json({ success: false, error: "Erro ao iniciar sessão" }, 500);
    }

    console.log(
      `[PONTO][TOTEM_LOGIN] codigo=${codigo_dispositivo} ok dispositivo=${disp.id}`,
    );

    return json({
      success: true,
      device_secret,
      dispositivo: {
        id: disp.id,
        nome: disp.nome,
        codigo_dispositivo: disp.codigo_dispositivo,
        centro_custo_id: disp.centro_custo_id,
      },
    });
  } catch (e) {
    console.error("[PONTO][TOTEM_LOGIN] erro geral:", (e as Error)?.message || e);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
