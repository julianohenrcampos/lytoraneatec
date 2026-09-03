/**
 * CT-5 — Puxadas (transporte de material com N caminhões + N motoristas).
 *
 * Contratos espelhando 1:1 as RPCs já aplicadas e validadas:
 *   fn_ct_puxada_listar          → { puxadas: CtPuxada[] } (sem `caminhoes`, com total)
 *   fn_ct_puxada_json            → CtPuxada (com `caminhoes`)
 *   fn_ct_puxada_salvar_rascunho → CtPuxadaComandoResult
 *   fn_ct_puxada_programar       → CtPuxadaComandoResult
 *   fn_ct_puxada_cancelar        → CtPuxadaCancelamentoResult
 *
 * Nada é inferido no cliente: disponibilidade de caminhão, numeração PUX e
 * conflitos por data são decididos exclusivamente no servidor.
 */
import type { CtRotaSnapshot } from "./centralTransporteMovDireta";

export type CtPuxadaStatus =
  | "RASCUNHO"
  | "PROGRAMADA"
  | "EM_EXECUCAO"
  | "CONCLUIDA"
  | "CANCELADA";

export const CT_PUXADA_STATUS_LABELS: Record<CtPuxadaStatus, string> = {
  RASCUNHO: "Rascunho",
  PROGRAMADA: "Programada",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

/** Ponto operacional da puxada (coleta ou descarga). */
export interface CtPuxadaPonto {
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Caminhão + motorista persistidos em bd_ct_puxada_caminhoes. */
export interface CtPuxadaCaminhao {
  id: string;
  caminhaoEquipamentoId: string;
  frota: string | null;
  placa: string | null;
  motoristaFuncionarioId: string | null;
  motoristaNome: string | null;
}

/** Puxada autoritativa devolvida pelo servidor. */
export interface CtPuxada {
  id: string;
  codigo: string | null;
  status: CtPuxadaStatus;
  dataPuxada: string | null;
  centroCustoId: string | null;
  ccCodigo: string | null;
  ccNome: string | null;
  planejadorNome: string | null;
  coleta: CtPuxadaPonto;
  descarga: CtPuxadaPonto;
  distanciaRotaKm: number | null;
  duracaoRotaMin: number | null;
  rotaResumo: string | null;
  rotaGeometria: { type: "LineString"; coordinates: [number, number][] } | null;
  observacoes: string | null;
  programadaEm: string | null;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  /** Presente em fn_ct_puxada_json; vazio na listagem (que traz só o total). */
  caminhoes: CtPuxadaCaminhao[];
  totalCaminhoes: number;
}

/** Caminhão em edição no cliente (existe até o rascunho ser salvo). */
export interface CtPuxadaCaminhaoRascunho {
  /** Chave local estável — nunca enviada ao servidor. */
  chaveLocal: string;
  caminhaoEquipamentoId: string;
  rotulo: string;
  placa: string | null;
  motoristaFuncionarioId: string | null;
  motoristaNome: string;
}

/** Puxada em edição no cliente. */
export interface CtPuxadaRascunho {
  puxadaId: string | null;
  codigo: string | null;
  dataPuxada: string;
  centroCustoId: string | null;
  coletaEndereco: string;
  coletaLatitude: number | null;
  coletaLongitude: number | null;
  descargaEndereco: string;
  descargaLatitude: number | null;
  descargaLongitude: number | null;
  observacoes: string;
  caminhoes: CtPuxadaCaminhaoRascunho[];
  /** Snapshot da rota (Directions API) — persistido em bd_ct_puxadas. */
  rotaPlanejada: CtRotaSnapshot | null;
}

export interface CtPuxadaComandoResult {
  ok: true;
  replay: boolean;
  puxadaId: string;
  puxada: CtPuxada | null;
}

export interface CtPuxadaCancelamentoResult {
  ok: true;
  replay: boolean;
  puxadaId: string;
  status: CtPuxadaStatus;
  motivo: string | null;
}

/** Motorista habilitado (fn_motoristas_operacional_lookup). */
export interface CtMotoristaOperacional {
  id: string;
  nomeCompleto: string;
  matricula: string | null;
  funcaoNome: string | null;
}
