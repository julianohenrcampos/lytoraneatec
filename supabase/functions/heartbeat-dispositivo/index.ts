import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  validarDispositivoTotem,
  extrairIp,
} from "../_shared/ponto-helpers.ts";
import { validarPayloadHeartbeat } from "../_shared/ponto-validators.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // API Key global
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = Deno.env.get("LYTOTEC_API_KEY");
    if (!apiKey || apiKey !== expectedApiKey) {
      return new Response(JSON.stringify({ error: "API key inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const validacao = validarPayloadHeartbeat(body);
    if (!validacao.valido || !validacao.dados) {
      return new Response(JSON.stringify({ error: validacao.erro }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = validacao.dados;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Validar dispositivo + device secret
    const deviceSecret = req.headers.get("x-device-secret");
    const dispResult = await validarDispositivoTotem(supabaseAdmin, payload.codigo_dispositivo, deviceSecret);
    if (!dispResult.valido) {
      return new Response(JSON.stringify({ error: dispResult.erro }), {
        status: dispResult.status!, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update heartbeat
    const { error: updateError } = await supabaseAdmin
      .from("bd_ponto_dispositivos")
      .update({
        ultimo_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispResult.dispositivo!.id);

    if (updateError) {
      console.error("[heartbeat] UPDATE falhou:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar heartbeat" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Alertas opcionais
    if (payload.bateria != null && payload.bateria < 15) {
      console.warn(`[heartbeat] ALERTA bateria baixa: ${payload.codigo_dispositivo} = ${payload.bateria}%`);
    }

    if (payload.status === "erro") {
      console.warn(`[heartbeat] ALERTA dispositivo com erro: ${payload.codigo_dispositivo}`);
    }

    console.log(
      `[heartbeat] OK disp=${payload.codigo_dispositivo} bat=${payload.bateria ?? "N/A"}% ver=${payload.versao_app ?? "N/A"}`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        servidor_hora: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[heartbeat] Erro geral:", e);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
