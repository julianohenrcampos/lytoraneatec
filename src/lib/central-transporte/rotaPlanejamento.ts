/**
 * CT-4 — Regras puras da rota planejada do rascunho de Movimentação Direta.
 *
 * A geometria SEMPRE vem da Directions API (ctRotaService); aqui só decidimos
 * quais pontos entram na rota, em que ordem, e se o snapshot atual ficou stale
 * em relação às coordenadas atuais do rascunho. Nada é inventado.
 */
import type { CtMovDiretaRascunho } from "@/types/centralTransporteMovDireta";
import type { CtCoordenada, CtRotaAlternativa } from "@/services/ctRotaService";

const coordValida = (lat: number | null, lng: number | null): boolean =>
  Number.isFinite(lat as number) &&
  Number.isFinite(lng as number) &&
  Math.abs(lat as number) <= 90 &&
  Math.abs(lng as number) <= 180 &&
  !(lat === 0 && lng === 0);

/**
 * Pontos da rota na ordem operacional: origem da coleta e depois cada parada.
 * Somente pontos com coordenada real entram — sem coordenada não há rota.
 */
export const coordenadasRotaRascunho = (r: CtMovDiretaRascunho): CtCoordenada[] => {
  const pontos: CtCoordenada[] = [];
  if (coordValida(r.origemLatitude, r.origemLongitude)) {
    pontos.push({ latitude: r.origemLatitude as number, longitude: r.origemLongitude as number });
  }
  r.paradas.forEach((p) => {
    if (coordValida(p.latitude, p.longitude)) {
      pontos.push({ latitude: p.latitude as number, longitude: p.longitude as number });
    }
  });
  return pontos;
};

/**
 * Rota calculável exige trajeto COMPLETO: origem geolocalizada, ao menos uma
 * parada e TODAS as paradas com coordenada. Trajeto parcial não gera rota —
 * assim nunca desenhamos/persistimos um caminho que ignora uma entrega.
 */
export const podeCalcularRota = (r: CtMovDiretaRascunho): boolean =>
  coordValida(r.origemLatitude, r.origemLongitude) &&
  r.paradas.length >= 1 &&
  r.paradas.every((p) => coordValida(p.latitude, p.longitude));


/**
 * Assinatura determinística dos pontos (lng,lat na ordem) — usada só para
 * detectar mudança de trajeto e evitar recálculo desnecessário.
 */
export const assinaturaRota = (r: CtMovDiretaRascunho): string =>
  coordenadasRotaRascunho(r)
    .map((c) => `${c.longitude.toFixed(6)},${c.latitude.toFixed(6)}`)
    .join(";");

/** Snapshot stale: dá para calcular e não há geometria válida da assinatura atual. */
export const rotaEstaStale = (
  r: CtMovDiretaRascunho,
  assinaturaCalculada: string | null,
): boolean => {
  if (!podeCalcularRota(r)) return false;
  const g = r.rotaPlanejada?.geometria;
  const geometriaValida =
    !!g && g.type === "LineString" && Array.isArray(g.coordinates) && g.coordinates.length > 2;
  if (!geometriaValida) return true;
  return assinaturaCalculada !== assinaturaRota(r);
};

/** Valida e compõe, sem mutação, o snapshot único visto, enviado e persistido. */
export const rascunhoComRotaDirections = (
  rascunho: CtMovDiretaRascunho,
  rota: CtRotaAlternativa,
): CtMovDiretaRascunho | null => {
  const geometriaValida =
    rota.geometria?.type === "LineString" && rota.geometria.coordinates.length > 2;
  if (
    !geometriaValida ||
    !Number.isFinite(rota.distanciaKm) ||
    rota.distanciaKm <= 0 ||
    !Number.isFinite(rota.duracaoMin) ||
    (rota.duracaoMin as number) <= 0
  ) {
    return null;
  }
  return {
    ...rascunho,
    rotaPlanejada: {
      distanciaKm: rota.distanciaKm,
      duracaoMin: rota.duracaoMin,
      resumo: rota.resumo,
      geometria: rota.geometria,
    },
  };
};
