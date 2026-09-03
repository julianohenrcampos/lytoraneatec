/**
 * T14/T15/T19/T20 — Autopreenchimento determinístico da viagem de mobilização.
 *
 * REGRAS ESTRUTURAIS
 *  - funções PURAS: nenhum acesso a rede, estado ou React aqui;
 *  - o autopreenchimento é apenas VALOR INICIAL: qualquer ajuste manual do
 *    usuário (coordenada/ponto já preenchidos) NUNCA é sobrescrito;
 *  - coordenada ausente é ausente: nada é inventado, nada vira 0,0;
 *  - a assinatura estável evita loop de patch/render e chamadas repetidas ao
 *    Mapbox (uma chamada por combinação de coordenadas).
 */
import type { CtViagemRascunho } from "@/types/centralTransporteMobilizacao";

/** Centro de custo com endereço e coordenadas cadastradas (bd_centros_custo). */
export interface CcGeoInfo {
  id: string;
  codigo: string | null;
  nome: string | null;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type CcGeoMap = Record<string, CcGeoInfo | undefined>;

/** "L123 — Obra X" a partir do cadastro (nunca texto digitado). */
export const rotuloCc = (cc: CcGeoInfo | null | undefined): string =>
  cc ? [cc.codigo, cc.nome].filter(Boolean).join(" — ") || "Centro de custo sem identificação" : "—";

const coordValida = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n !== 0;

/** Assinatura estável dos centros de custo da viagem (anti-loop de patch). */
export const assinaturaCcViagem = (v: CtViagemRascunho): string =>
  `${v.origemCentroCustoId ?? "-"}|${v.destinoCentroCustoId ?? "-"}`;

/**
 * Patch inicial de endereço/coordenadas a partir do cadastro dos CCs.
 * Devolve `null` quando não há nada a preencher (nenhum setState desnecessário).
 */
export function patchAutoEnderecoCoordenadas(
  v: CtViagemRascunho,
  ccPorId: CcGeoMap,
): Partial<CtViagemRascunho> | null {
  const patch: Partial<CtViagemRascunho> = {};

  const origem = v.origemCentroCustoId ? ccPorId[v.origemCentroCustoId] : undefined;
  const destino = v.destinoCentroCustoId ? ccPorId[v.destinoCentroCustoId] : undefined;

  if (origem) {
    const semCoordManual =
      v.origemColetaLatitude === null && v.origemColetaLongitude === null;
    if (semCoordManual && coordValida(origem.latitude) && coordValida(origem.longitude)) {
      patch.origemColetaLatitude = origem.latitude;
      patch.origemColetaLongitude = origem.longitude;
    }
    if (!v.origemPontoExato.trim() && origem.endereco) {
      patch.origemPontoExato = origem.endereco;
    }
  }

  if (destino) {
    const semCoordManual =
      v.destinoDescargaLatitude === null && v.destinoDescargaLongitude === null;
    if (semCoordManual && coordValida(destino.latitude) && coordValida(destino.longitude)) {
      patch.destinoDescargaLatitude = destino.latitude;
      patch.destinoDescargaLongitude = destino.longitude;
    }
    if (!v.destinoPontoExato.trim() && destino.endereco) {
      patch.destinoPontoExato = destino.endereco;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Assinatura da rota. `null` quando não existem as quatro coordenadas válidas
 * — nesse caso o Mapbox NUNCA é chamado (T20).
 */
export function assinaturaRota(v: CtViagemRascunho): string | null {
  const { origemColetaLatitude: oLat, origemColetaLongitude: oLng } = v;
  const { destinoDescargaLatitude: dLat, destinoDescargaLongitude: dLng } = v;
  if (![oLat, oLng, dLat, dLng].every((c) => typeof c === "number" && Number.isFinite(c))) {
    return null;
  }
  return `${oLat},${oLng}|${dLat},${dLng}`;
}

/** Lados sem geolocalização utilizável (aviso funcional, sem inventar ponto). */
export function ladosSemGeolocalizacao(v: CtViagemRascunho): ("origem" | "destino")[] {
  const faltas: ("origem" | "destino")[] = [];
  if (v.origemColetaLatitude === null || v.origemColetaLongitude === null) faltas.push("origem");
  if (v.destinoDescargaLatitude === null || v.destinoDescargaLongitude === null) {
    faltas.push("destino");
  }
  return faltas;
}

/** Já existe rota persistida/aplicada para esta viagem? */
export const temRotaAplicada = (v: CtViagemRascunho): boolean =>
  v.distanciaRotaKm !== null && Number.isFinite(v.distanciaRotaKm);
