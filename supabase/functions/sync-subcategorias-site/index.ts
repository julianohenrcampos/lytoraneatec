import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Fetch subcategorias from local DB using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subcategorias, error: dbError } = await supabaseAdmin
      .from("bd_subcategorias_ativos")
      .select("nome_subcategoria, categoria:bd_categorias_ativos(nome_categoria)")
      .eq("ativo", true);

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `Erro ao buscar subcategorias: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subcategorias || subcategorias.length === 0) {
      return new Response(
        JSON.stringify({ processados: 0, total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = subcategorias.map((s: any) => ({
      nome: s.nome_subcategoria,
      categoria: s.categoria?.nome_categoria || null,
    }));

    // Call SITE API
    const apiKey = Deno.env.get("LYTOTEC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LYTOTEC_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteResponse = await fetch(
      "https://vitxtbotmtxfytusptbf.supabase.co/functions/v1/subcategorias-sync",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ subcategorias: payload }),
      }
    );

    const responseText = await siteResponse.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { error: `SITE retornou: ${responseText}`, status: siteResponse.status };
    }

    if (!siteResponse.ok) {
      return new Response(JSON.stringify(result), {
        status: siteResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
