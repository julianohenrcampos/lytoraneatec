// Ranking suave (score-only) de resultados do Mapbox para o contexto operacional
// (Centro de Custo). Puro, sem rede, sem alterar banco.
//
// Regras (B.3.5-D.M7-A revisada):
// - NÃO descartar resultados por UF/cidade divergente.
// - Score aditivo: relevance + UF esperada + cidade + bairro + proximity.
// - proximity é o sinal mais forte quando não há cidade cadastrada.

import type { GeocodeFeature } from "@/hooks/useGeocoding";

// Raio (km) usado para: (a) saturar bônus de distância no score e
// (b) calcular bbox de proximidade no chamador. Ajuste aqui.
export const PROX_RADIUS_KM = 50;

export interface RankContext {
  proximity?: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number];
  cidade?: string;
  uf?: string;
  bairro?: string;
}

export interface RankResult {
  features: GeocodeFeature[];
  // Mantidas por compatibilidade — sempre false, o ranker não filtra mais.
  filteredOutOfCity: boolean;
  filteredOutOfUf: boolean;
}

const norm = (s?: string): string =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const UF_MAP: Record<string, string> = {
  ac: "acre", al: "alagoas", ap: "amapa", am: "amazonas", ba: "bahia",
  ce: "ceara", df: "distrito federal", es: "espirito santo", go: "goias",
  ma: "maranhao", mt: "mato grosso", ms: "mato grosso do sul", mg: "minas gerais",
  pa: "para", pb: "paraiba", pr: "parana", pe: "pernambuco", pi: "piaui",
  rj: "rio de janeiro", rn: "rio grande do norte", rs: "rio grande do sul",
  ro: "rondonia", rr: "roraima", sc: "santa catarina", sp: "sao paulo",
  se: "sergipe", to: "tocantins",
};
const NAME_TO_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_MAP).map(([uf, nome]) => [nome, uf])
);

function ufEquivalente(a?: string, b?: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (UF_MAP[na] && UF_MAP[na] === nb) return true;
  if (UF_MAP[nb] && UF_MAP[nb] === na) return true;
  if (NAME_TO_UF[na] && NAME_TO_UF[na] === nb) return true;
  if (NAME_TO_UF[nb] && NAME_TO_UF[nb] === na) return true;
  return false;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function rankAddressResults(
  features: GeocodeFeature[],
  ctx?: RankContext
): RankResult {
  if (!features || features.length === 0) {
    return { features: [], filteredOutOfCity: false, filteredOutOfUf: false };
  }
  if (!ctx || (!ctx.cidade && !ctx.uf && !ctx.bairro && !ctx.proximity)) {
    return { features, filteredOutOfCity: false, filteredOutOfUf: false };
  }

  const cidadeEsperada = ctx.cidade ? norm(ctx.cidade) : "";
  const bairroEsperado = ctx.bairro ? norm(ctx.bairro) : "";
  const boostProximity = !cidadeEsperada;

  const scored = features.map((f) => {
    const relevance = Number(f.relevance ?? 0);
    let score = relevance;

    if (ctx.uf && ufEquivalente(f.context?.estado, ctx.uf)) score += 0.5;
    if (cidadeEsperada && norm(f.context?.cidade) === cidadeEsperada) score += 0.3;
    if (bairroEsperado && norm(f.context?.bairro) === bairroEsperado) score += 0.2;

    if (ctx.proximity && Array.isArray(f.center) && f.center.length === 2) {
      const distKm = haversineKm(ctx.proximity, f.center as [number, number]);
      const clamped = Math.min(distKm, PROX_RADIUS_KM);
      // Bônus máximo mais alto quando não há cidade esperada.
      const maxBonus = boostProximity ? 0.8 : 0.4;
      score += maxBonus * (1 - clamped / PROX_RADIUS_KM);
    }

    return { f, score, relevance };
  });

  scored.sort((a, b) => (b.score - a.score) || (b.relevance - a.relevance));

  return {
    features: scored.map((s) => s.f),
    filteredOutOfCity: false,
    filteredOutOfUf: false,
  };
}
