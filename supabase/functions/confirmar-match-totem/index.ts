import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-device-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const deviceSecret = req.headers.get("x-device-secret");
    if (!deviceSecret) return json({ error: "device_secret_obrigatorio" }, 401);

    const body = await req.json().catch(() => null);
    const codigo = String(body?.codigo_dispositivo || "").trim().toUpperCase();
    const logId: string | null = body?.log_id ?? null;
    const funcionarioConfirmadoId: string | null = body?.funcionario_id ?? null;

    if (!codigo || !logId || !funcionarioConfirmadoId) {
      return json({ error: "payload_invalido" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validar dispositivo
    const { data: disp, error: dispErr } = await supabase
      .from("bd_ponto_dispositivos")
      .select("id, ativo, tipo, device_session_token, device_session_expires_at")
      .eq("codigo_dispositivo", codigo)
      .maybeSingle();

    if (dispErr || !disp) return json({ error: "dispositivo_invalido" }, 401);
    if (disp.tipo !== "dispositivo_obra" || !disp.ativo) {
      return json({ error: "dispositivo_invalido" }, 401);
    }
    if (disp.device_session_token !== deviceSecret) {
      return json({ error: "sessao_invalida" }, 401);
    }
    if (disp.device_session_expires_at && new Date(disp.device_session_expires_at) < new Date()) {
      return json({ error: "sessao_expirada" }, 401);
    }

    const { error: upErr } = await supabase
      .from("bd_ponto_match_log")
      .update({
        funcionario_confirmado_id: funcionarioConfirmadoId,
        confirmado_em: new Date().toISOString(),
      })
      .eq("id", logId)
      .eq("dispositivo_id", disp.id);

    if (upErr) {
      console.error("[confirmar-match-totem] erro update:", upErr);
      return json({ error: "erro_update", detail: upErr.message }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[confirmar-match-totem] erro:", (e as Error)?.message || e);
    return json({ error: "erro_interno", detail: (e as Error)?.message }, 500);
  }
});
