// Ranking/filtro local de resultados do Mapbox para o contexto operacional
// (Centro de Custo). Puro, sem rede, sem alterar banco.
//
// Regras (§4 do plano aprovado):
// - descartar resultados fora da UF esperada quando UF for conhecida
// - preferir cidade esperada; se NENHUM bater, retorna vazio + flag
// - priorizar bairro esperado
// - priorizar menor distância haversine à proximity

import type { GeocodeFeature } from "@/hooks/useGeocoding";

export interface RankContext {
  proximity?: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number];
  cidade?: string;
  uf?: string;
  bairro?: string;
}

export interface RankResult {
  features: GeocodeFeature[];
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

  // 1) Filtro rígido por UF quando definida
  let stage: GeocodeFeature[] = features;
  if (ctx.uf) {
    const emUf = stage.filter((f) => ufEquivalente(f.context?.estado, ctx.uf));
    if (emUf.length === 0) {
      return { features: [], filteredOutOfCity: false, filteredOutOfUf: true };
    }
    stage = emUf;
  }

  // 2) Preferência por cidade — se nenhum bater, sinaliza
  if (cidadeEsperada) {
    const emCidade = stage.filter(
      (f) => norm(f.context?.cidade) === cidadeEsperada
    );
    if (emCidade.length === 0) {
      return { features: [], filteredOutOfCity: true, filteredOutOfUf: false };
    }
    stage = emCidade;
  }

  // 3) Score final
  const scored = stage.map((f) => {
    let score = Number(f.relevance ?? 0);
    if (bairroEsperado && norm(f.context?.bairro) === bairroEsperado) score += 0.3;
    if (ctx.proximity && Array.isArray(f.center) && f.center.length === 2) {
      const distKm = haversineKm(ctx.proximity, f.center as [number, number]);
      score += Math.max(0, 0.4 - Math.min(distKm, 20) / 50);
    }
    return { f, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    features: scored.map((s) => s.f),
    filteredOutOfCity: false,
    filteredOutOfUf: false,
  };
}
