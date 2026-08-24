/**
 * CT-4 Fase 3 — regras puras do painel operacional de Movimentações.
 *
 * Tudo aqui é derivado do que o servidor já devolveu em
 * `fn_ct_mov_direta_listar` (nenhuma query nova, nenhuma rota inventada):
 * filtro client-side, contadores do resumo e projeção GeoJSON da rota
 * persistida (`rota_geometria`) e dos pontos operacionais.
 */
import type { CtOrdemMotorista, CtViagemStatus } from "@/types/centralTransporteMobilizacao";

export interface MovFiltroState {
  busca: string;
  status: string;
  data: string;
  motoristaId: string;
}

export const filtroVazio = (): MovFiltroState => ({
  busca: "",
  status: "TODOS",
  data: "",
  motoristaId: "TODOS",
});

export const filtroAtivo = (f: MovFiltroState): boolean =>
  f.busca.trim() !== "" || f.status !== "TODOS" || f.data !== "" || f.motoristaId !== "TODOS";

const norm = (v: string | null | undefined): string =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

/** Texto pesquisável de uma movimentação (código, ativos, motorista, obras). */
export const textoBusca = (v: CtOrdemMotorista): string =>
  [
    v.codigo,
    v.motoristaNome,
    v.placaTransportador,
    v.origemCentroCusto,
    v.origemEndereco,
    ...v.paradas.flatMap((p) => [p.ccCodigo, p.ccNome, p.endereco]),
    ...v.cargas.flatMap((c) => [c.frota, c.numeroFrota, c.placa]),
  ]
    .map(norm)
    .filter(Boolean)
    .join(" ");

export const filtrarMovimentacoes = (
  viagens: CtOrdemMotorista[],
  f: MovFiltroState,
): CtOrdemMotorista[] => {
  const termo = norm(f.busca).trim();
  return viagens.filter((v) => {
    /* Canceladas não compõem o conjunto operacional ativo: só aparecem
       quando o usuário pede explicitamente o status Cancelada. */
    if (f.status === "TODOS" && v.status === "CANCELADA") return false;
    if (f.status !== "TODOS" && v.status !== f.status) return false;
    if (f.data && (v.dataPrevistaSaida ?? "").slice(0, 10) !== f.data) return false;
    if (f.motoristaId !== "TODOS" && (v.motoristaId ?? "") !== f.motoristaId) return false;
    if (termo && !textoBusca(v).includes(termo)) return false;
    return true;
  });
};

export interface MovResumo {
  rascunhos: number;
  programadas: number;
  emTransito: number;
  concluidasHoje: number;
}

/** Contadores do resumo — derivados da lista já carregada. */
export const contarResumo = (viagens: CtOrdemMotorista[], hoje: string): MovResumo => ({
  rascunhos: viagens.filter((v) => v.status === "RASCUNHO").length,
  programadas: viagens.filter((v) => v.status === "PROGRAMADA").length,
  emTransito: viagens.filter((v) => v.status === "EM_TRANSITO").length,
  concluidasHoje: viagens.filter(
    (v) => v.status === "CONCLUIDA" && (v.dataPrevistaSaida ?? "").slice(0, 10) === hoje,
  ).length,
});

/** Rótulo curto de um ponto: código do CC quando existir. */
const rotuloCc = (codigo: string | null, nome: string | null): string =>
  codigo || nome || "Sem obra";

/** "TESTE-001 → L448 → L535" */
export const resumoTrajeto = (v: CtOrdemMotorista): string =>
  [
    rotuloCc(null, v.origemCentroCusto),
    ...v.paradas.map((p) => rotuloCc(p.ccCodigo, p.ccNome)),
  ].join(" → ");

/**
 * Resumo compacto para o card: "TESTE-001 → L448" (+N quando houver mais
 * paradas). Somente códigos/rótulos já presentes no snapshot do servidor.
 */
export const resumoTrajetoCurto = (v: CtOrdemMotorista): string => {
  const origem = rotuloCc(null, v.origemCentroCusto);
  if (v.paradas.length === 0) return origem;
  const primeira = rotuloCc(v.paradas[0].ccCodigo, v.paradas[0].ccNome);
  const extras = v.paradas.length - 1;
  return `${origem} → ${primeira}${extras > 0 ? ` +${extras}` : ""}`;
};

export const totalAtivos = (v: CtOrdemMotorista): number => v.cargas.length;


const coordValida = (lat: number | null, lng: number | null): boolean =>
  Number.isFinite(lat as number) &&
  Number.isFinite(lng as number) &&
  Math.abs(lat as number) <= 90 &&
  Math.abs(lng as number) <= 180 &&
  !(lat === 0 && lng === 0);

export interface MovPonto {
  movId: string;
  codigo: string;
  tipo: "ORIGEM" | "PARADA";
  ordem: number | null;
  totalParadas: number;
  rotulo: string;
  titulo: string;
  endereco: string | null;
  quando: string | null;
  pessoa: string | null;
  ativos: number;
  coord: [number, number];
}

/** Pontos operacionais com coordenada real (origem + paradas). Nada é inferido. */
export const pontosDaMovimentacao = (v: CtOrdemMotorista): MovPonto[] => {
  const pontos: MovPonto[] = [];
  if (coordValida(v.origemLatitude, v.origemLongitude)) {
    pontos.push({
      movId: v.id,
      codigo: v.codigo || "Rascunho",
      tipo: "ORIGEM",
      ordem: null,
      totalParadas: v.paradas.length,
      rotulo: "●",
      titulo: rotuloCc(null, v.origemCentroCusto),
      endereco: v.origemEndereco ?? v.origemPontoExato ?? null,
      quando: v.dataPrevistaSaida ?? null,
      pessoa: v.motoristaNome ?? null,
      ativos: v.cargas.length,
      coord: [v.origemLongitude as number, v.origemLatitude as number],
    });
  }
  v.paradas.forEach((p) => {
    if (!coordValida(p.latitude, p.longitude)) return;
    pontos.push({
      movId: v.id,
      codigo: v.codigo || "Rascunho",
      tipo: "PARADA",
      ordem: p.ordem,
      totalParadas: v.paradas.length,
      rotulo: String(p.ordem),
      titulo: `${rotuloCc(p.ccCodigo, null)} ${p.ccNome ?? ""}`.trim(),
      endereco: p.endereco ?? p.pontoExato ?? null,
      quando: [p.dataPrevista, p.horaPrevista].filter(Boolean).join(" ") || null,
      pessoa: p.recebedorPrevistoNome ?? null,
      ativos: p.cargas.length,
      coord: [p.longitude as number, p.latitude as number],
    });
  });
  return pontos;
};

export type LineFeature = {
  type: "Feature";
  properties: { mov_id: string; codigo: string; status: CtViagemStatus; selecionado: boolean };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

/**
 * Rota apenas quando existe geometria PERSISTIDA. Sem geometria não há linha —
 * o cliente nunca chama Directions para montar a lista.
 */
export const rotaFeature = (
  v: CtOrdemMotorista,
  selecionado: boolean,
): LineFeature | null => {
  const g = v.rotaGeometria;
  if (!g || g.type !== "LineString" || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
    return null;
  }
  return {
    type: "Feature",
    properties: {
      mov_id: v.id,
      codigo: v.codigo || "Rascunho",
      status: v.status,
      selecionado,
    },
    geometry: { type: "LineString", coordinates: g.coordinates },
  };
};

/** Coordenadas usadas para enquadrar a movimentação selecionada. */
export const coordenadasParaFit = (v: CtOrdemMotorista): [number, number][] => {
  const rota = rotaFeature(v, true);
  if (rota) return rota.geometry.coordinates;
  return pontosDaMovimentacao(v).map((p) => p.coord);
};

/** Distância/duração exibidas — sempre o snapshot do servidor. */
export const resumoRota = (v: CtOrdemMotorista): string | null => {
  const km = v.distanciaRotaKm ?? v.distanciaKm;
  if (!Number.isFinite(km as number)) return null;
  const dist = `${(km as number).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  return v.duracaoRotaMin ? `${dist} • ~${v.duracaoRotaMin} min` : dist;
};

/**
 * Chip de distância/duração posicionado no meio da rota persistida.
 * Só existe quando o servidor já devolveu geometria + distância; nada é
 * calculado ou estimado no cliente (não há legs no contrato atual).
 */
export const chipRotaFeature = (
  v: CtOrdemMotorista,
): {
  type: "Feature";
  properties: { mov_id: string; distancia: string; duracao: string };
  geometry: { type: "Point"; coordinates: [number, number] };
} | null => {
  const rota = rotaFeature(v, true);
  const km = v.distanciaRotaKm ?? v.distanciaKm;
  if (!rota || !Number.isFinite(km as number)) return null;
  const coords = rota.geometry.coordinates;
  const meio = coords[Math.floor(coords.length / 2)];
  return {
    type: "Feature",
    properties: {
      mov_id: v.id,
      distancia: `${(km as number).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`,
      duracao: v.duracaoRotaMin ? `${v.duracaoRotaMin} min` : "",
    },
    geometry: { type: "Point", coordinates: meio },
  };
};
