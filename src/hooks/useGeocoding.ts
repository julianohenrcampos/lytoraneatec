import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeocodeFeature {
  place_name: string;
  center: [number, number];
  address?: string;
  text?: string;
  context?: { bairro?: string; cidade?: string; estado?: string; cep?: string };
  relevance?: number;
  place_type?: string;
  geocoding_status?: "auto" | "aproximado" | "erro";
  source?: "cache" | "mapbox";
  endereco_normalizado?: string;
}

export interface ReverseResult {
  place_name: string;
  latitude: number;
  longitude: number;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  relevance?: number;
  place_type?: string;
}

export interface GeocodingOpts {
  proximity?: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number];
  types?: string;
  limit?: number;
  autocompleteFlag?: boolean;
}

let cachedPublicToken: string | null = null;

export function useGeocoding() {
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const autocomplete = useCallback(
    async (query: string, opts?: GeocodingOpts): Promise<GeocodeFeature[]> => {
      if (!query || query.trim().length < 3) return [];

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      try {
        const body: Record<string, unknown> = { action: "autocomplete", query };
        if (opts?.proximity) body.proximity = opts.proximity;
        if (opts?.bbox) body.bbox = opts.bbox;
        if (opts?.types) body.types = opts.types;
        if (typeof opts?.limit === "number") body.limit = opts.limit;
        if (typeof opts?.autocompleteFlag === "boolean")
          body.autocompleteFlag = opts.autocompleteFlag;

        const { data, error } = await supabase.functions.invoke("geocode-proxy", { body });
        if (error) throw error;
        return (data?.features || []) as GeocodeFeature[];
      } catch (e: any) {
        if (e?.name === "AbortError") return [];
        console.error("autocomplete error:", e);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const geocode = useCallback(
    async (query: string, opts?: GeocodingOpts): Promise<GeocodeFeature | null> => {
      if (!query || query.trim().length < 3) return null;
      setLoading(true);
      try {
        const body: Record<string, unknown> = { action: "geocode", query };
        if (opts?.proximity) body.proximity = opts.proximity;
        if (opts?.bbox) body.bbox = opts.bbox;
        if (opts?.types) body.types = opts.types;
        if (typeof opts?.limit === "number") body.limit = opts.limit;

        const { data, error } = await supabase.functions.invoke("geocode-proxy", { body });
        if (error) throw error;
        const r = data?.result;
        if (!r) return null;
        return {
          place_name: r.place_name,
          center: [Number(r.longitude), Number(r.latitude)],
          address: r.endereco_numero,
          text: r.endereco_rua,
          context: r.context || {
            bairro: r.endereco_bairro,
            cidade: r.endereco_cidade,
            estado: r.endereco_estado,
            cep: r.endereco_cep,
          },
          relevance: r.geocoding_relevance ?? r.relevance,
          place_type: r.place_type,
          geocoding_status: r.geocoding_status,
          source: r.geocoding_source,
          endereco_normalizado: r.endereco_normalizado,
        } as GeocodeFeature;
      } catch (e) {
        console.error("geocode error:", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reverse = useCallback(async (latitude: number, longitude: number): Promise<ReverseResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-proxy", {
        body: { action: "reverse", latitude, longitude },
      });
      if (error) throw error;
      return (data?.result || null) as ReverseResult | null;
    } catch (e) {
      console.error("reverse error:", e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPublicToken = useCallback(async (): Promise<string | null> => {
    if (cachedPublicToken) return cachedPublicToken;
    try {
      const { data, error } = await supabase.functions.invoke("get-mapbox-public-token");
      if (error) throw error;
      cachedPublicToken = data?.token || null;
      return cachedPublicToken;
    } catch (e) {
      console.error("getPublicToken error:", e);
      return null;
    }
  }, []);

  return { loading, autocomplete, geocode, reverse, getPublicToken };
}
