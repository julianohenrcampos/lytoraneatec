// Edge Function: geocode-proxy v2
// Ações suportadas via body.action:
//   - "autocomplete" → busca textual com cache + fallback progressivo
//   - "geocode"      → resolução de endereço único com classificação de qualidade
//   - "reverse"      → reverse geocoding a partir de lat/lng
// Mantém compat com chamadas antigas (sem action) → usa "autocomplete".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ----------------------------------------------------------------
// Normalização avançada
// ----------------------------------------------------------------
function normalizeAddress(input: string): string {
  if (!input) return "";
  let s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s,.-]/g, " ");

  // Remove ruídos típicos de loteamento/industrial
  const noise = [
    /\blote(amento)?\s*\w*/g,
    /\bquadra\s*\w*/g,
    /\bzona\s+industrial\b/g,
    /\bvia\s+coletora\b/g,
    /\bgleba\s*\w*/g,
    /\bsetor\s*\w*/g,
    /\bs\/n\b/g,
    /\bsem\s+numero\b/g,
  ];
  for (const r of noise) s = s.replace(r, " ");

  s = s.replace(/\s+/g, " ").trim().replace(/^[,.\s-]+|[,.\s-]+$/g, "");
  return s;
}

// Classifica resultado do Mapbox: auto | aproximado | erro
function classify(feature: any): { status: "auto" | "aproximado" | "erro"; relevance: number; placeType: string } {
  const relevance = Number(feature?.relevance ?? 0);
  const placeType = (feature?.place_type?.[0] || "").toLowerCase();

  if (placeType === "address" && relevance >= 0.75) {
    return { status: "auto", relevance, placeType };
  }
  if (placeType === "postcode" && relevance >= 0.7) {
    return { status: "aproximado", relevance, placeType };
  }
  if (["place", "locality", "neighborhood", "region"].includes(placeType)) {
    return { status: "aproximado", relevance, placeType };
  }
  if (relevance >= 0.75) {
    return { status: "auto", relevance, placeType };
  }
  if (relevance > 0) {
    return { status: "aproximado", relevance, placeType };
  }
  return { status: "erro", relevance: 0, placeType };
}

function parseContext(f: any) {
  const ctx: Record<string, string> = {};
  for (const c of f.context || []) {
    if (c.id?.startsWith("neighborhood")) ctx.bairro = c.text;
    if (c.id?.startsWith("place")) ctx.cidade = c.text;
    if (c.id?.startsWith("region")) ctx.estado = c.text;
    if (c.id?.startsWith("postcode")) ctx.cep = c.text;
  }
  return ctx;
}

async function logFalha(
  supabase: any,
  motivo: string,
  endereco_original: string,
  endereco_normalizado: string,
  detalhes?: any
) {
  try {
    await supabase.from("bd_geocoding_falhas").insert({
      endereco_original,
      endereco_normalizado,
      motivo,
      contexto: "edge:geocode-proxy",
      detalhes: detalhes ?? null,
    });
  } catch (e) {
    console.error("logFalha error:", e);
  }
}

// ----------------------------------------------------------------
// Mapbox calls
// ----------------------------------------------------------------
interface ForwardOpts {
  limit?: number;
  proximity?: [number, number];
  bbox?: [number, number, number, number];
  types?: string;
  autocompleteFlag?: boolean;
}

function buildForwardUrl(query: string, token: string, opts: ForwardOpts = {}): string {
  const limit = opts.limit ?? 5;
  let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${token}&country=br&language=pt&limit=${limit}`;
  if (opts.proximity && Array.isArray(opts.proximity) && opts.proximity.length === 2) {
    const [lng, lat] = opts.proximity;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      url += `&proximity=${lng},${lat}`;
    }
  }
  if (opts.bbox && Array.isArray(opts.bbox) && opts.bbox.length === 4 && opts.bbox.every((n) => Number.isFinite(n))) {
    url += `&bbox=${opts.bbox.join(",")}`;
  }
  if (opts.types) {
    url += `&types=${encodeURIComponent(opts.types)}`;
  }
  if (typeof opts.autocompleteFlag === "boolean") {
    url += `&autocomplete=${opts.autocompleteFlag ? "true" : "false"}`;
  }
  return url;
}

async function mapboxForward(query: string, token: string, limitOrOpts: number | ForwardOpts = 5) {
  const opts: ForwardOpts =
    typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts;
  const url = buildForwardUrl(query, token, opts);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`mapbox forward ${r.status}`);
  return r.json();
}

async function mapboxReverse(lng: number, lat: number, token: string) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=pt&limit=1`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`mapbox reverse ${r.status}`);
  return r.json();
}

// ----------------------------------------------------------------
// Handler
// ----------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action: string = body.action || "autocomplete";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const mapboxToken = Deno.env.get("MAPBOX_TOKEN");
    if (!mapboxToken) {
      return new Response(
        JSON.stringify({ error: "MAPBOX_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------- REVERSE ----------------
    if (action === "reverse") {
      const { latitude, longitude } = body;
      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return new Response(
          JSON.stringify({ error: "latitude e longitude são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const data = await mapboxReverse(longitude, latitude, mapboxToken);
      const f = data.features?.[0];
      if (!f) {
        return new Response(JSON.stringify({ result: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ctx = parseContext(f);
      return new Response(
        JSON.stringify({
          result: {
            place_name: f.place_name,
            longitude: f.center[0],
            latitude: f.center[1],
            endereco_rua: f.text || "",
            endereco_numero: f.address || "",
            endereco_bairro: ctx.bairro || "",
            endereco_cidade: ctx.cidade || "",
            endereco_estado: ctx.estado || "",
            endereco_cep: ctx.cep || "",
            relevance: Number(f.relevance ?? 0),
            place_type: (f.place_type?.[0] || ""),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------- GEOCODE (single result) ----------------
    if (action === "geocode") {
      const q: string = (body.query || "").trim();
      if (!q || q.length < 3) {
        return new Response(
          JSON.stringify({ error: "Query deve ter pelo menos 3 caracteres" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const original = q;
      const normalizado = normalizeAddress(original);

      const extraOpts: ForwardOpts = {
        limit: 1,
        proximity: body.proximity,
        bbox: body.bbox,
        types: body.types,
      };
      const hasSpatialCtx = !!(extraOpts.proximity || extraOpts.bbox);

      // cache — pular quando houver contexto espacial (proximity/bbox)
      if (!hasSpatialCtx) {
        const { data: cachedRows } = await supabase
          .from("bd_cache_enderecos")
          .select("*")
          .or(`endereco_normalizado.eq.${normalizado},endereco.eq.${normalizado}`)
          .limit(1);

        if (cachedRows && cachedRows.length > 0) {
          const c = cachedRows[0];
          return new Response(
            JSON.stringify({
              result: {
                place_name: c.place_name || c.endereco,
                latitude: Number(c.latitude),
                longitude: Number(c.longitude),
                relevance: Number(c.relevance ?? 0.9),
                place_type: c.place_type || "address",
                geocoding_status: c.geocoding_status || "auto",
                geocoding_source: "cache",
                geocoding_relevance: Number(c.relevance ?? 0.9),
                endereco_normalizado: c.endereco_normalizado || normalizado,
                context: {},
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // fallback progressivo
      const tries = [normalizado, original];
      let best: any = null;
      for (const t of tries) {
        try {
          const data = await mapboxForward(t, mapboxToken, extraOpts);
          if (data.features?.length) { best = data.features[0]; break; }
        } catch (e) {
          console.error("geocode fallback erro em", t, e);
        }
      }


      if (!best) {
        await logFalha(supabase, "sem_resultado", original, normalizado);
        return new Response(
          JSON.stringify({
            result: {
              place_name: original,
              latitude: null,
              longitude: null,
              geocoding_status: "erro",
              geocoding_source: "mapbox",
              geocoding_relevance: 0,
              endereco_normalizado: normalizado,
              context: {},
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cls = classify(best);
      const ctx = parseContext(best);
      const result = {
        place_name: best.place_name,
        latitude: best.center[1],
        longitude: best.center[0],
        endereco_rua: best.text || "",
        endereco_numero: best.address || "",
        endereco_bairro: ctx.bairro || "",
        endereco_cidade: ctx.cidade || "",
        endereco_estado: ctx.estado || "",
        endereco_cep: ctx.cep || "",
        relevance: cls.relevance,
        place_type: cls.placeType,
        geocoding_status: cls.status,
        geocoding_source: "mapbox",
        geocoding_relevance: cls.relevance,
        endereco_normalizado: normalizado,
        context: ctx,
      };

      // Cache write — apenas quando não houve contexto espacial e status=auto
      if (!hasSpatialCtx && cls.status === "auto") {
        await supabase
          .from("bd_cache_enderecos")
          .upsert(
            {
              endereco: best.place_name.toLowerCase(),
              endereco_original: original,
              endereco_normalizado: normalizado,
              place_name: best.place_name,
              latitude: best.center[1],
              longitude: best.center[0],
              relevance: cls.relevance,
              place_type: cls.placeType,
              geocoding_status: cls.status,
            },
            { onConflict: "endereco" }
          );
      } else if (cls.status === "erro") {
        await logFalha(supabase, "qualidade_baixa", original, normalizado, { relevance: cls.relevance, place_type: cls.placeType });
      }

      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------- AUTOCOMPLETE ----------------
    const query: string = body.query;
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Query deve ter pelo menos 3 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const original = query.trim();
    const normalizado = normalizeAddress(original);

    const autoExtraOpts: ForwardOpts = {
      limit: typeof body.limit === "number" ? body.limit : 5,
      proximity: body.proximity,
      bbox: body.bbox,
      types: body.types,
      autocompleteFlag:
        typeof body.autocompleteFlag === "boolean" ? body.autocompleteFlag : true,
    };
    const autoHasSpatialCtx = !!(autoExtraOpts.proximity || autoExtraOpts.bbox);

    // 1. Cache lookup — pular quando houver contexto espacial
    if (!autoHasSpatialCtx) {
      const { data: cachedRows } = await supabase
        .from("bd_cache_enderecos")
        .select("*")
        .or(`endereco_normalizado.eq.${normalizado},endereco.eq.${normalizado}`)
        .limit(5);

      if (cachedRows && cachedRows.length > 0) {
        const features = cachedRows.map((c: any) => ({
          place_name: c.place_name || c.endereco,
          center: [Number(c.longitude), Number(c.latitude)],
          relevance: Number(c.relevance ?? 0.9),
          place_type: c.place_type || "address",
          from_cache: true,
          source: "cache",
          geocoding_status: c.geocoding_status || "auto",
          endereco_normalizado: c.endereco_normalizado || normalizado,
        }));
        return new Response(JSON.stringify({ features, source: "cache" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Fallback progressivo
    const tries = [normalizado, original];
    let mapboxData: any = null;
    let usedQuery = "";

    for (const q of tries) {
      try {
        const data = await mapboxForward(q, mapboxToken, autoExtraOpts);
        if (data.features && data.features.length > 0) {
          mapboxData = data;
          usedQuery = q;
          break;
        }
      } catch (e) {
        console.error("mapbox fallback erro em", q, e);
      }
    }

    if (!mapboxData || !mapboxData.features?.length) {
      await logFalha(supabase, "sem_resultado", original, normalizado);
      return new Response(JSON.stringify({ features: [], source: "mapbox" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const features = mapboxData.features.map((f: any) => {
      const cls = classify(f);
      const ctx = parseContext(f);
      return {
        place_name: f.place_name,
        center: f.center,
        address: f.address || "",
        text: f.text || "",
        context: ctx,
        relevance: cls.relevance,
        place_type: cls.placeType,
        geocoding_status: cls.status,
        source: "mapbox",
        endereco_normalizado: normalizado,
      };
    });

    // 3. Cache em background — pular quando houve contexto espacial
    if (!autoHasSpatialCtx) {
      for (const f of features) {
        if (f.geocoding_status === "auto" && f.place_name && f.center) {
          await supabase
            .from("bd_cache_enderecos")
            .upsert(
              {
                endereco: f.place_name.toLowerCase(),
                endereco_original: original,
                endereco_normalizado: normalizado,
                place_name: f.place_name,
                latitude: f.center[1],
                longitude: f.center[0],
                relevance: f.relevance,
                place_type: f.place_type,
                geocoding_status: f.geocoding_status,
              },
              { onConflict: "endereco" }
            )
            .then(() => {});
        }
      }
    }

    return new Response(JSON.stringify({ features, source: "mapbox", used_query: usedQuery }), {
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
