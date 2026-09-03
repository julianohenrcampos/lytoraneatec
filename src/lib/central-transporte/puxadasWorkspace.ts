/**
 * CT-5 — regras puras do painel operacional de Puxadas.
 *
 * Tudo é derivado do que `fn_ct_puxada_listar` já devolveu: filtro
 * client-side, contadores do resumo e projeção GeoJSON da rota PERSISTIDA.
 * Nenhuma rota é inventada aqui.
 */
import type { CtPuxada, CtPuxadaStatus } from "@/types/centralTransportePuxada";

export interface PuxadaFiltroState {
  busca: string;
  status: string;
  data: string;
  centroCustoId: string;
}

export const filtroPuxadaVazio = (): PuxadaFiltroState => ({
  busca: "",
  status: "TODOS",
  data: "",
  centroCustoId: "TODOS",
});

export const filtroPuxadaAtivo = (f: PuxadaFiltroState): boolean =>
  f.busca.trim() !== "" ||
  f.status !== "TODOS" ||
  f.data !== "" ||
  f.centroCustoId !== "TODOS";

const norm = (v: string | null | undefined): string =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

export const textoBuscaPuxada = (p: CtPuxada): string =>
  [
    p.codigo,
    p.ccCodigo,
    p.ccNome,
    p.planejadorNome,
    p.coleta.endereco,
    p.descarga.endereco,
    ...p.caminhoes.flatMap((c) => [c.frota, c.placa, c.motoristaNome]),
  ]
    .map(norm)
    .filter(Boolean)
    .join(" ");

export const filtrarPuxadas = (
  puxadas: CtPuxada[],
  f: PuxadaFiltroState,
): CtPuxada[] => {
  const termo = norm(f.busca).trim();
  return puxadas.filter((p) => {
    /* Canceladas são histórico: só aparecem quando pedidas explicitamente. */
    if (f.status === "TODOS" && p.status === "CANCELADA") return false;
    if (f.status !== "TODOS" && p.status !== f.status) return false;
    if (f.data && (p.dataPuxada ?? "").slice(0, 10) !== f.data) return false;
    if (f.centroCustoId !== "TODOS" && (p.centroCustoId ?? "") !== f.centroCustoId) return false;
    if (termo && !textoBuscaPuxada(p).includes(termo)) return false;
    return true;
  });
};

export interface PuxadaResumo {
  rascunhos: number;
  programadas: number;
  emExecucao: number;
  caminhoesHoje: number;
}

export const contarResumoPuxadas = (puxadas: CtPuxada[], hoje: string): PuxadaResumo => ({
  rascunhos: puxadas.filter((p) => p.status === "RASCUNHO").length,
  programadas: puxadas.filter((p) => p.status === "PROGRAMADA").length,
  emExecucao: puxadas.filter((p) => p.status === "EM_EXECUCAO").length,
  caminhoesHoje: puxadas
    .filter(
      (p) =>
        (p.dataPuxada ?? "").slice(0, 10) === hoje &&
        (p.status === "PROGRAMADA" || p.status === "EM_EXECUCAO"),
    )
    .reduce((acc, p) => acc + p.totalCaminhoes, 0),
});

const rotulo = (codigo: string | null, nome: string | null): string =>
  codigo || nome || "Sem obra";

/** "CONM104 → descarga" com base apenas no snapshot do servidor. */
export const resumoTrajetoPuxada = (p: CtPuxada): string => {
  const origem = p.coleta.endereco || rotulo(p.ccCodigo, p.ccNome);
  const destino = p.descarga.endereco || "Descarga não informada";
  return `${origem} → ${destino}`;
};

export const resumoRotaPuxada = (p: CtPuxada): string | null => {
  if (!Number.isFinite(p.distanciaRotaKm as number)) return null;
  const dist = `${(p.distanciaRotaKm as number).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} km`;
  return p.duracaoRotaMin ? `${dist} • ~${p.duracaoRotaMin} min` : dist;
};

const coordValida = (lat: number | null, lng: number | null): boolean =>
  Number.isFinite(lat as number) &&
  Number.isFinite(lng as number) &&
  Math.abs(lat as number) <= 90 &&
  Math.abs(lng as number) <= 180 &&
  !(lat === 0 && lng === 0);

export interface PuxadaPonto {
  puxadaId: string;
  codigo: string;
  tipo: "COLETA" | "DESCARGA";
  titulo: string;
  endereco: string | null;
  quando: string | null;
  caminhoes: number;
  coord: [number, number];
}

/** Pontos com coordenada real (coleta e descarga). Nada é inferido. */
export const pontosDaPuxada = (p: CtPuxada): PuxadaPonto[] => {
  const base = {
    puxadaId: p.id,
    codigo: p.codigo || "Rascunho",
    quando: (p.dataPuxada ?? "").slice(0, 10) || null,
    caminhoes: p.totalCaminhoes,
  };
  const pontos: PuxadaPonto[] = [];
  if (coordValida(p.coleta.latitude, p.coleta.longitude)) {
    pontos.push({
      ...base,
      tipo: "COLETA",
      titulo: `Coleta — ${rotulo(p.ccCodigo, p.ccNome)}`,
      endereco: p.coleta.endereco,
      coord: [p.coleta.longitude as number, p.coleta.latitude as number],
    });
  }
  if (coordValida(p.descarga.latitude, p.descarga.longitude)) {
    pontos.push({
      ...base,
      tipo: "DESCARGA",
      titulo: "Descarga",
      endereco: p.descarga.endereco,
      coord: [p.descarga.longitude as number, p.descarga.latitude as number],
    });
  }
  return pontos;
};

export type PuxadaLineFeature = {
  type: "Feature";
  properties: {
    puxada_id: string;
    codigo: string;
    status: CtPuxadaStatus;
    selecionado: boolean;
  };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

/** Rota apenas quando existe geometria PERSISTIDA (ou já resolvida sob demanda). */
export const rotaFeaturePuxada = (
  p: CtPuxada,
  selecionado: boolean,
): PuxadaLineFeature | null => {
  const g = p.rotaGeometria;
  if (!g || g.type !== "LineString" || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
    return null;
  }
  return {
    type: "Feature",
    properties: {
      puxada_id: p.id,
      codigo: p.codigo || "Rascunho",
      status: p.status,
      selecionado,
    },
    geometry: { type: "LineString", coordinates: g.coordinates },
  };
};

export const coordenadasParaFitPuxada = (p: CtPuxada): [number, number][] => {
  const rota = rotaFeaturePuxada(p, true);
  if (rota) return rota.geometry.coordinates;
  return pontosDaPuxada(p).map((x) => x.coord);
};

/** Chip de distância/duração no meio da rota persistida. */
export const chipRotaFeaturePuxada = (
  p: CtPuxada,
): {
  type: "Feature";
  properties: { puxada_id: string; distancia: string; duracao: string };
  geometry: { type: "Point"; coordinates: [number, number] };
} | null => {
  const rota = rotaFeaturePuxada(p, true);
  if (!rota || !Number.isFinite(p.distanciaRotaKm as number)) return null;
  const coords = rota.geometry.coordinates;
  return {
    type: "Feature",
    properties: {
      puxada_id: p.id,
      distancia: `${(p.distanciaRotaKm as number).toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
      })} km`,
      duracao: p.duracaoRotaMin ? `${p.duracaoRotaMin} min` : "",
    },
    geometry: { type: "Point", coordinates: coords[Math.floor(coords.length / 2)] },
  };
};
