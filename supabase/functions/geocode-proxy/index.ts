import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Query deve ter pelo menos 3 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const normalizedQuery = query.trim().toLowerCase();
    const { data: cached } = await supabase
      .from("bd_cache_enderecos")
      .select("*")
      .ilike("endereco", normalizedQuery)
      .limit(5);

    if (cached && cached.length > 0) {
      const features = cached.map((c: any) => ({
        place_name: c.endereco,
        center: [Number(c.longitude), Number(c.latitude)],
        from_cache: true,
      }));
      return new Response(JSON.stringify({ features }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Mapbox Geocoding API
    const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: "MAPBOX_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&country=br&language=pt&limit=5`;

    const mapboxRes = await fetch(mapboxUrl);
    if (!mapboxRes.ok) {
      const errText = await mapboxRes.text();
      console.error("Mapbox error:", errText);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar Mapbox" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mapboxData = await mapboxRes.json();
    const features = (mapboxData.features || []).map((f: any) => {
      // Parse context for structured address fields
      const context: Record<string, string> = {};
      for (const ctx of f.context || []) {
        if (ctx.id?.startsWith("neighborhood")) context.bairro = ctx.text;
        if (ctx.id?.startsWith("place")) context.cidade = ctx.text;
        if (ctx.id?.startsWith("region")) context.estado = ctx.text;
        if (ctx.id?.startsWith("postcode")) context.cep = ctx.text;
      }

      return {
        place_name: f.place_name,
        center: f.center,
        address: f.address || "",
        text: f.text || "",
        context,
      };
    });

    // Cache results in background
    for (const f of features) {
      if (f.place_name && f.center) {
        await supabase
          .from("bd_cache_enderecos")
          .upsert(
            {
              endereco: f.place_name.toLowerCase(),
              latitude: f.center[1],
              longitude: f.center[0],
            },
            { onConflict: "endereco" }
          )
          .then(() => {});
      }
    }

    return new Response(JSON.stringify({ features }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("geocode-proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno no servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
