/**
 * CT-4 — Movimentação Direta (viagem sem solicitação) e viagem multiparadas.
 *
 * Contratos espelhando 1:1 as RPCs:
 *   fn_ct_ativos_movimentacao_listar    → CtAtivoMovimentacao[]
 *   fn_ct_mov_direta_listar / _estado   → CtOrdemMotorista (fn_ct_viagem_json)
 *   fn_ct_mov_direta_salvar_rascunho    → CtMovDiretaComandoResult
 *   fn_ct_mov_direta_programar          → CtMovDiretaComandoResult
 *   fn_ct_mov_direta_cancelar           → CtMovDiretaComandoResult
 *   fn_ct_parada_registrar_chegada      → { ok, replay, parada_id, status }
 *
 * Nenhuma elegibilidade é inferida no cliente: `elegivel` e `bloqueioMotivo`
 * vêm do servidor, que revalida tudo na programação.
 */
import type { CtModalidade, CtOrdemMotorista, CtTipoTransporte } from "./centralTransporteMobilizacao";

/** Ativo elegível (ou bloqueado) para uma movimentação direta. */
export interface CtAtivoMovimentacao {
  equipamentoId: string;
  frota: string | null;
  numeroFrota: string | null;
  placa: string | null;
  tipoAtivo: string | null;
  modelo: string | null;
  centroCustoId: string | null;
  centroCustoLabel: string | null;
  statusOperacional: string;
  possuiRegistro: boolean;
  compromissoViagem: string | null;
  /** Número da OS de manutenção aberta que impede a movimentação, se houver. */
  osManutencao: string | null;
  elegivel: boolean;
  bloqueioMotivo: string | null;
}


export const rotuloAtivoMovimentacao = (a: CtAtivoMovimentacao): string =>
  [a.frota, a.numeroFrota].filter(Boolean).join("-") || a.placa || a.equipamentoId;

/** Parada em edição no cliente (só existe até o rascunho ser salvo). */
export interface CtParadaRascunho {
  /** Chave local estável — nunca enviada ao servidor. */
  chaveLocal: string;
  centroCustoId: string | null;
  endereco: string;
  pontoExato: string;
  latitude: number | null;
  longitude: number | null;
  dataPrevista: string;
  horaPrevista: string;
  observacao: string;
  recebedorPrevistoFuncionarioId: string | null;
  recebedorPrevistoNome: string;
  /** Equipamentos entregues nesta parada. */
  equipamentos: string[];
}

/** Movimentação direta em edição no cliente. */
export interface CtMovDiretaRascunho {
  viagemId: string | null;
  codigo: string | null;
  modalidade: CtModalidade | null;
  tipoTransporte: CtTipoTransporte | null;
  motoristaId: string | null;
  motoristaNome: string;
  veiculoTransportadorId: string | null;
  placaTransportador: string;
  empresaTransportadoraId: string | null;
  dataPrevistaSaida: string;
  origemCentroCustoId: string | null;
  origemEndereco: string;
  origemPontoExato: string;
  origemLatitude: number | null;
  origemLongitude: number | null;
  observacoes: string;
  paradas: CtParadaRascunho[];
  /**
   * Ativos participantes da movimentação, inclusive os que ainda não têm
   * parada de entrega. Persistidos em bd_movimentacoes com parada_id NULL.
   */
  ativosPlanejados: string[];
  /** CT-4 Fase 1 — snapshot da rota planejada (Mapbox), quando calculada. */
  rotaPlanejada: CtRotaSnapshot | null;
}

/** Snapshot da rota planejada persistido em bd_ct_viagens. */
export interface CtRotaSnapshot {
  distanciaKm: number;
  duracaoMin: number | null;
  resumo: string | null;
  geometria: { type: "LineString"; coordinates: [number, number][] } | null;
}


export interface CtMovDiretaComandoResult {
  ok: true;
  replay: boolean;
  viagemId: string;
  viagem: CtOrdemMotorista | null;
}

export interface CtParadaChegadaResult {
  ok: true;
  replay: boolean;
  paradaId: string;
  status: string;
}
