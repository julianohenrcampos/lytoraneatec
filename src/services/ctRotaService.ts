/**
 * CT-3D / CT-3D.1 — Rota e distância entre o ponto de coleta e o ponto de descarga.
 *
 * Reutiliza o token público já servido por `get-mapbox-public-token` e a
 * Directions API do Mapbox. Sem coordenadas resolvidas não existe distância:
 * a função devolve `null` e a UI mostra "Rota não calculada" — nada é inventado.
 *
 * CT-3D.1 acrescenta as ALTERNATIVAS de rota (padrão Google Maps): até 3
 * trajetos com geometria, distância, duração e resumo das vias.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CtCoordenada {
  latitude: number;
  longitude: number;
}

export interface CtRotaCalculada {
  distanciaKm: number;
  duracaoMin: number | null;
}

/** Alternativa de rota devolvida pela Directions API. */
export interface CtRotaAlternativa {
  indice: number;
  distanciaKm: number;
  duracaoMin: number | null;
  /** Resumo das principais vias ("BR-101, RJ-099"). */
  resumo: string;
  /** GeoJSON LineString para desenhar no mapa. */
  geometria: { type: "LineString"; coordinates: [number, number][] } | null;
}

let tokenCache: string | null = null;

export const obterTokenMapbox = async (): Promise<string | null> => {
  if (tokenCache) return tokenCache;
  try {
    const { data, error } = await supabase.functions.invoke("get-mapbox-public-token");
    if (error) throw error;
    tokenCache = (data as { token?: string } | null)?.token ?? null;
    return tokenCache;
  } catch (e) {
    console.error("ctRotaService.obterToken", e);
    return null;
  }
};

const valida = (c: CtCoordenada | null): c is CtCoordenada =>
  !!c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude);

const km = (m: number) => Math.round((m / 1000) * 10) / 10;

/** Calcula a rota rodoviária. Retorna null quando não há como calcular. */
export const calcularRotaMobilizacao = async (
  origem: CtCoordenada | null,
  destino: CtCoordenada | null,
): Promise<CtRotaCalculada | null> => {
  const alternativas = await calcularAlternativasRota(origem, destino);
  if (!alternativas || alternativas.length === 0) return null;
  const r = alternativas[0];
  return { distanciaKm: r.distanciaKm, duracaoMin: r.duracaoMin };
};

/**
 * Alternativas de rota (até 3), no padrão visual do Google Maps.
 * Retorna null quando faltam coordenadas ou o Mapbox não responde.
 */
export const calcularAlternativasRota = async (
  origem: CtCoordenada | null,
  destino: CtCoordenada | null,
): Promise<CtRotaAlternativa[] | null> => {
  if (!valida(origem) || !valida(destino)) return null;

  const token = await obterTokenMapbox();
  if (!token) return null;

  try {
    const coords = `${origem.longitude},${origem.latitude};${destino.longitude},${destino.latitude}`;
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?alternatives=true&overview=full&geometries=geojson&steps=false&language=pt` +
      `&access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("ctRotaService directions", resp.status, await resp.text());
      return null;
    }
    const json = (await resp.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { type?: string; coordinates?: [number, number][] };
        legs?: Array<{ summary?: string }>;
      }>;
    };
    const rotas = (json.routes ?? []).filter((r) => Number.isFinite(r.distance));
    if (rotas.length === 0) return null;

    return rotas.slice(0, 3).map((r, i) => ({
      indice: i,
      distanciaKm: km(r.distance as number),
      duracaoMin: Number.isFinite(r.duration) ? Math.round((r.duration as number) / 60) : null,
      resumo:
        (r.legs ?? [])
          .map((l) => (l.summary ?? "").trim())
          .filter(Boolean)
          .join(", ") || (i === 0 ? "Rota mais rápida" : `Alternativa ${i + 1}`),
      geometria:
        r.geometry?.type === "LineString" && Array.isArray(r.geometry.coordinates)
          ? { type: "LineString", coordinates: r.geometry.coordinates }
          : null,
    }));
  } catch (e) {
    console.error("ctRotaService.calcularAlternativasRota", e);
    return null;
  }
};

/**
 * CT-4 Fase 1 — rota multiparadas (origem + N paradas, na ordem informada).
 * Mapbox Directions aceita até 25 waypoints; acima disso não há rota.
 * Sem 2 pontos válidos não existe rota: devolve null (nada é inventado).
 */
export const calcularRotaMultiparadas = async (
  pontos: Array<CtCoordenada | null>,
): Promise<CtRotaAlternativa | null> => {
  const validos = pontos.filter(valida);
  if (validos.length < 2 || validos.length > 25) return null;

  const token = await obterTokenMapbox();
  if (!token) return null;

  try {
    const coords = validos.map((p) => `${p.longitude},${p.latitude}`).join(";");
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?alternatives=false&overview=full&geometries=geojson&steps=false&language=pt` +
      `&access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("ctRotaService multiparadas", resp.status, await resp.text());
      return null;
    }
    const json = (await resp.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { type?: string; coordinates?: [number, number][] };
        legs?: Array<{ summary?: string }>;
      }>;
    };
    const r = (json.routes ?? [])[0];
    if (!r || !Number.isFinite(r.distance)) return null;

    return {
      indice: 0,
      distanciaKm: km(r.distance as number),
      duracaoMin: Number.isFinite(r.duration) ? Math.round((r.duration as number) / 60) : null,
      resumo:
        (r.legs ?? [])
          .map((l) => (l.summary ?? "").trim())
          .filter(Boolean)
          .join(" → ") || "Rota planejada",
      geometria:
        r.geometry?.type === "LineString" && Array.isArray(r.geometry.coordinates)
          ? { type: "LineString", coordinates: r.geometry.coordinates }
          : null,
    };
  } catch (e) {
    console.error("ctRotaService.calcularRotaMultiparadas", e);
    return null;
  }
};

export default calcularRotaMobilizacao;
