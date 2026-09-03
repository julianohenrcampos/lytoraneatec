/**
 * CT-5 — Regras puras do rascunho de Puxada.
 *
 * Monta o payload autoritativo de `fn_ct_puxada_salvar_rascunho` e valida
 * exatamente os invariantes que o servidor também cobra (fail-closed no
 * cliente só para evitar ida e volta — quem decide é o banco).
 */
import type {
  CtPuxada,
  CtPuxadaCaminhaoRascunho,
  CtPuxadaRascunho,
} from "@/types/centralTransportePuxada";
import type { CtCoordenada, CtRotaAlternativa } from "@/services/ctRotaService";

let contador = 0;
const novaChave = (): string => `caminhao-${Date.now().toString(36)}-${(contador += 1)}`;

export const rascunhoPuxadaVazio = (): CtPuxadaRascunho => ({
  puxadaId: null,
  codigo: null,
  dataPuxada: "",
  centroCustoId: null,
  coletaEndereco: "",
  coletaLatitude: null,
  coletaLongitude: null,
  descargaEndereco: "",
  descargaLatitude: null,
  descargaLongitude: null,
  observacoes: "",
  caminhoes: [],
  rotaPlanejada: null,
});

export const caminhaoRascunho = (dados: {
  caminhaoEquipamentoId: string;
  rotulo: string;
  placa?: string | null;
}): CtPuxadaCaminhaoRascunho => ({
  chaveLocal: novaChave(),
  caminhaoEquipamentoId: dados.caminhaoEquipamentoId,
  rotulo: dados.rotulo,
  placa: dados.placa ?? null,
  motoristaFuncionarioId: null,
  motoristaNome: "",
});

/** Hidrata o rascunho a partir do estado autoritativo do servidor. */
export const hidratarPuxada = (p: CtPuxada): CtPuxadaRascunho => ({
  puxadaId: p.id,
  codigo: p.codigo,
  dataPuxada: (p.dataPuxada ?? "").slice(0, 10),
  centroCustoId: p.centroCustoId,
  coletaEndereco: p.coleta.endereco ?? "",
  coletaLatitude: p.coleta.latitude,
  coletaLongitude: p.coleta.longitude,
  descargaEndereco: p.descarga.endereco ?? "",
  descargaLatitude: p.descarga.latitude,
  descargaLongitude: p.descarga.longitude,
  observacoes: p.observacoes ?? "",
  caminhoes: p.caminhoes.map((c) => ({
    chaveLocal: c.id,
    caminhaoEquipamentoId: c.caminhaoEquipamentoId,
    rotulo: c.frota || c.placa || c.caminhaoEquipamentoId.slice(0, 8),
    placa: c.placa,
    motoristaFuncionarioId: c.motoristaFuncionarioId,
    motoristaNome: c.motoristaNome ?? "",
  })),
  rotaPlanejada:
    p.distanciaRotaKm !== null
      ? {
          distanciaKm: p.distanciaRotaKm,
          duracaoMin: p.duracaoRotaMin,
          resumo: p.rotaResumo,
          geometria: p.rotaGeometria,
        }
      : null,
});

/** Caminhões já escolhidos — impede o mesmo caminhão duas vezes na puxada. */
export const caminhoesJaEscolhidos = (r: CtPuxadaRascunho): Set<string> =>
  new Set(r.caminhoes.map((c) => c.caminhaoEquipamentoId));

/**
 * Validação mínima. O salvamento de rascunho é permissivo (data + centro de
 * custo, igual à RPC); a programação exige trajeto, rota e caminhões completos.
 */
export const validarPuxada = (
  r: CtPuxadaRascunho,
  finalidade: "RASCUNHO" | "PROGRAMAR",
): string[] => {
  const erros: string[] = [];

  if (!r.dataPuxada) erros.push("Informe a data da puxada.");
  if (!r.centroCustoId) erros.push("Informe o centro de custo da puxada.");

  const vistos = new Set<string>();
  for (const c of r.caminhoes) {
    if (vistos.has(c.caminhaoEquipamentoId)) {
      erros.push("O mesmo caminhão não pode ser incluído duas vezes na puxada.");
      break;
    }
    vistos.add(c.caminhaoEquipamentoId);
  }

  if (finalidade === "PROGRAMAR") {
    if (r.caminhoes.length === 0)
      erros.push("Adicione ao menos um caminhão com motorista.");
    r.caminhoes.forEach((c) => {
      if (!c.motoristaFuncionarioId)
        erros.push(`Informe o motorista do caminhão ${c.rotulo}.`);
    });
    if (!coordValida(r.coletaLatitude, r.coletaLongitude))
      erros.push("Confirme o ponto de coleta no mapa.");
    if (!coordValida(r.descargaLatitude, r.descargaLongitude))
      erros.push("Confirme o ponto de descarga no mapa.");
  }

  return erros;
};

export const montarPayloadPuxada = (r: CtPuxadaRascunho): Record<string, unknown> => ({
  data_puxada: r.dataPuxada || null,
  centro_custo_id: r.centroCustoId,
  coleta: {
    endereco: r.coletaEndereco.trim() || null,
    latitude: r.coletaLatitude,
    longitude: r.coletaLongitude,
  },
  descarga: {
    endereco: r.descargaEndereco.trim() || null,
    latitude: r.descargaLatitude,
    longitude: r.descargaLongitude,
  },
  observacoes: r.observacoes.trim() || null,
  caminhoes: r.caminhoes.map((c) => ({
    caminhao_equipamento_id: c.caminhaoEquipamentoId,
    motorista_funcionario_id: c.motoristaFuncionarioId,
  })),
  rota: r.rotaPlanejada
    ? {
        distancia_km: r.rotaPlanejada.distanciaKm,
        duracao_min: r.rotaPlanejada.duracaoMin,
        resumo: r.rotaPlanejada.resumo,
        geometria: r.rotaPlanejada.geometria,
      }
    : null,
});

/* ------------------------------ rota ------------------------------ */

const coordValida = (lat: number | null, lng: number | null): boolean =>
  Number.isFinite(lat as number) &&
  Number.isFinite(lng as number) &&
  Math.abs(lat as number) <= 90 &&
  Math.abs(lng as number) <= 180 &&
  !(lat === 0 && lng === 0);

/** Pontos da rota na ordem operacional: coleta → descarga. */
export const coordenadasRotaPuxada = (r: CtPuxadaRascunho): CtCoordenada[] => {
  const pontos: CtCoordenada[] = [];
  if (coordValida(r.coletaLatitude, r.coletaLongitude)) {
    pontos.push({ latitude: r.coletaLatitude as number, longitude: r.coletaLongitude as number });
  }
  if (coordValida(r.descargaLatitude, r.descargaLongitude)) {
    pontos.push({
      latitude: r.descargaLatitude as number,
      longitude: r.descargaLongitude as number,
    });
  }
  return pontos;
};

/** Rota calculável exige coleta E descarga geolocalizadas. */
export const podeCalcularRotaPuxada = (r: CtPuxadaRascunho): boolean =>
  coordenadasRotaPuxada(r).length === 2;

export const assinaturaRotaPuxada = (r: CtPuxadaRascunho): string =>
  coordenadasRotaPuxada(r)
    .map((c) => `${c.longitude.toFixed(6)},${c.latitude.toFixed(6)}`)
    .join(";");

/** Snapshot stale: dá para calcular e não há geometria da assinatura atual. */
export const rotaPuxadaEstaStale = (
  r: CtPuxadaRascunho,
  assinaturaCalculada: string | null,
): boolean => {
  if (!podeCalcularRotaPuxada(r)) return false;
  const g = r.rotaPlanejada?.geometria;
  const geometriaValida =
    !!g && g.type === "LineString" && Array.isArray(g.coordinates) && g.coordinates.length > 2;
  if (!geometriaValida) return true;
  return assinaturaCalculada !== assinaturaRotaPuxada(r);
};

/** Compõe (sem mutação) o snapshot único visto, enviado e persistido. */
export const puxadaComRotaDirections = (
  rascunho: CtPuxadaRascunho,
  rota: CtRotaAlternativa,
): CtPuxadaRascunho | null => {
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
