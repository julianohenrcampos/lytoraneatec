/**
 * CT-3C R2 — Service das RPCs de mobilização da Central do Transporte.
 *
 * Chama exclusivamente as 5 RPCs transacionais, com os nomes de parâmetro
 * exatos do contrato vivo. Nenhuma escrita direta em tabela: viagens
 * (bd_ct_viagens), movimentações (bd_movimentacoes) e versões do planejamento
 * (bd_solicitacoes_planejamento) são gravadas somente no servidor.
 *
 * Snapshots (nome/CPF do motorista, placa, nome e endereço dos centros de
 * custo) NÃO são enviados: a RPC resolve tudo a partir dos IDs.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CtAtivoEdicaoPermitida,
  CtAtivoMobilizavel,
  CtMobilizacaoComandoResult,
  CtMobilizacaoEstado,
  CtModalidade,
  CtPlanejamento,
  CtPlanejamentoStatus,
  CtTipoTransporte,
  CtViagem,
  CtViagemRascunho,
  CtViagemStatus,
} from "@/types/centralTransporteMobilizacao";

/* eslint-disable @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (tipos gerados não cobrem as RPCs CT-3C) */
const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CT2_RESPOSTA_INVALIDA");
  }
  return value as Record<string, unknown>;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const listaIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const mapAtivo = (raw: unknown): CtAtivoMobilizavel => {
  const r = asRecord(raw);
  return {
    atendimentoId: String(r.atendimento_id),
    solicitacaoItemId: String(r.solicitacao_item_id),
    equipamentoId: String(r.equipamento_id),
    frota: texto(r.equipamento_frota),
    numeroFrota: texto(r.equipamento_numero),
    placa: texto(r.equipamento_placa),
    statusAtendimento: String(r.status_atendimento ?? ""),
    periodoInicio: texto(r.periodo_inicio),
    periodoFim: texto(r.periodo_fim),
    centroCustoAtualId: texto(r.centro_custo_atual_id),
    centroCustoAtualNome: texto(r.centro_custo_atual_nome),
    movimentacaoId: texto(r.movimentacao_id),
    movimentacaoStatus: texto(r.movimentacao_status),
    viagemId: texto(r.viagem_id),
  };
};

const mapViagem = (raw: unknown): CtViagem => {
  const r = asRecord(raw);
  return {
    id: String(r.id),
    codigo: String(r.codigo ?? ""),
    status: (texto(r.status) ?? "RASCUNHO") as CtViagemStatus,
    modalidade: texto(r.modalidade_deslocamento) as CtModalidade | null,
    tipoTransporte: texto(r.tipo_transporte) as CtTipoTransporte | null,
    motoristaId: texto(r.motorista_id),
    motoristaNomeSnapshot: texto(r.motorista_nome_snapshot),
    motoristaCpfSnapshot: texto(r.motorista_cpf_snapshot),
    veiculoTransportadorId: texto(r.veiculo_transportador_id),
    placaTransportadorSnapshot: texto(r.placa_transportador_snapshot),
    empresaTransportadoraId: texto(r.empresa_transportadora_id),
    empresaTransportadoraNomeSnapshot: texto(r.empresa_transportadora_nome_snapshot),
    origemCentroCustoId: texto(r.origem_centro_custo_id),
    origemCcCodigoSnapshot: texto(r.origem_cc_codigo_snapshot),
    origemCcNomeSnapshot: texto(r.origem_cc_nome_snapshot),
    origemCcEnderecoSnapshot: texto(r.origem_cc_endereco_snapshot),
    destinoCentroCustoId: texto(r.destino_centro_custo_id),
    destinoCcCodigoSnapshot: texto(r.destino_cc_codigo_snapshot),
    destinoCcNomeSnapshot: texto(r.destino_cc_nome_snapshot),
    destinoCcEnderecoSnapshot: texto(r.destino_cc_endereco_snapshot),
    dataPrevistaSaida: texto(r.data_prevista_saida),
    dataPrevistaEntrega: texto(r.data_prevista_entrega),
    distanciaKm: numero(r.distancia_km),
    observacoes: texto(r.observacoes),
    atendimentoIds: listaIds(r.atendimento_ids),
  };
};

const mapPlanejamento = (raw: unknown): CtPlanejamento => {
  const p = asRecord(raw);
  return {
    id: String(p.id),
    versao: Number(p.versao ?? 1),
    status: (texto(p.status) ?? "RASCUNHO") as CtPlanejamentoStatus,
    vigente: p.vigente === true,
    lockVersion: Number(p.lock_version ?? 0),
    contentHash: texto(p.content_hash),
    dataPrevistaEntrega: texto(p.data_prevista_entrega),
    observacoes: texto(p.observacoes),
    programadoEm: texto(p.programado_em),
    revisaoDePlanejamentoId: texto(p.revisao_de_planejamento_id),
    viagens: Array.isArray(p.viagens) ? p.viagens.map(mapViagem) : [],
  };
};

export const fetchMobilizacaoEstado = async (
  solicitacaoId: string,
): Promise<CtMobilizacaoEstado> => {
  const data = asRecord(
    await rpc("fn_ct_mobilizacao_estado", { p_solicitacao_id: solicitacaoId }),
  );

  return {
    ok: true,
    solicitacaoId: String(data.solicitacao_id ?? solicitacaoId),
    planejamentoVigente: data.planejamento_vigente
      ? mapPlanejamento(data.planejamento_vigente)
      : null,
    rascunhoEmEdicao: data.rascunho_em_edicao ? mapPlanejamento(data.rascunho_em_edicao) : null,
    ativos: Array.isArray(data.ativos) ? data.ativos.map(mapAtivo) : [],
    viagens: Array.isArray(data.viagens) ? data.viagens.map(mapViagem) : [],
  };
};

/** Payload autoritativo de uma viagem: apenas IDs e dados não canônicos. */
export const serializarViagem = (v: CtViagemRascunho): Record<string, unknown> => ({
  id: v.id,
  client_ref: v.clientRef,
  modalidade_deslocamento: v.modalidade,
  tipo_transporte: v.modalidade === "TRANSPORTADO" ? v.tipoTransporte : null,
  motorista_id: v.motoristaId,
  motorista_nome: v.motoristaId ? null : v.motoristaNome.trim() || null,
  motorista_cpf: v.motoristaId ? null : v.motoristaCpf.replace(/\D/g, "") || null,
  veiculo_transportador_id: v.veiculoTransportadorId,
  placa_transportador: v.veiculoTransportadorId
    ? null
    : v.placaTransportador.trim().toUpperCase() || null,
  empresa_transportadora_id: v.empresaTransportadoraId,
  origem_centro_custo_id: v.origemCentroCustoId,
  destino_centro_custo_id: v.destinoCentroCustoId,
  data_prevista_saida: v.dataPrevistaSaida || null,
  data_prevista_entrega: v.dataProgramada || null,
  distancia_km: v.distanciaKm.trim() || null,
  observacoes: v.observacoes.trim() || null,
  atendimento_ids: v.atendimentoIds,
});

const mapComando = (
  raw: unknown,
  statusPadrao: CtPlanejamentoStatus,
): CtMobilizacaoComandoResult => {
  const data = asRecord(raw);
  return {
    ok: true,
    replay: data.replay === true,
    noChange: data.no_change === true,
    planejamentoId: String(data.planejamento_id),
    versao: Number(data.versao ?? 1),
    lockVersion: Number(data.lock_version ?? 0),
    status: (texto(data.status) ?? statusPadrao) as CtPlanejamentoStatus,
    contentHash: texto(data.content_hash),
  };
};

export interface SalvarRascunhoParams {
  solicitacaoId: string;
  /** null cria (ou reaproveita) o rascunho único vigente da solicitação. */
  planejamentoId: string | null;
  versaoEsperada: number | null;
  viagens: CtViagemRascunho[];
  requestId: string;
}

export const salvarRascunhoMobilizacao = async (
  p: SalvarRascunhoParams,
): Promise<CtMobilizacaoComandoResult> =>
  mapComando(
    await rpc("fn_ct_mobilizacao_salvar_rascunho", {
      p_solicitacao_id: p.solicitacaoId,
      p_planejamento_id: p.planejamentoId,
      p_versao_esperada: p.versaoEsperada,
      p_payload: { viagens: p.viagens.map(serializarViagem) },
      p_request_id: p.requestId,
    }),
    "RASCUNHO",
  );

export interface ProgramarMobilizacaoParams {
  planejamentoId: string;
  versaoEsperada: number | null;
  requestId: string;
}

export const programarMobilizacao = async (
  p: ProgramarMobilizacaoParams,
): Promise<CtMobilizacaoComandoResult> =>
  mapComando(
    await rpc("fn_ct_mobilizacao_programar", {
      p_planejamento_id: p.planejamentoId,
      p_versao_esperada: p.versaoEsperada,
      p_request_id: p.requestId,
    }),
    "PROGRAMADO",
  );

export interface CancelarRascunhoParams {
  planejamentoId: string;
  versaoEsperada: number | null;
  motivo: string | null;
  requestId: string;
}

export const cancelarRascunhoMobilizacao = async (
  p: CancelarRascunhoParams,
): Promise<CtMobilizacaoComandoResult> =>
  mapComando(
    await rpc("fn_ct_mobilizacao_cancelar", {
      p_planejamento_id: p.planejamentoId,
      p_versao_esperada: p.versaoEsperada,
      p_motivo: p.motivo?.trim() || null,
      p_request_id: p.requestId,
    }),
    "CANCELADO",
  );

export interface NovaRevisaoParams {
  planejamentoId: string;
  requestId: string;
}

export const abrirNovaRevisaoMobilizacao = async (
  p: NovaRevisaoParams,
): Promise<CtMobilizacaoComandoResult> =>
  mapComando(
    await rpc("fn_ct_mobilizacao_nova_revisao", {
      p_planejamento_id: p.planejamentoId,
      p_request_id: p.requestId,
    }),
    "RASCUNHO",
  );

/** Trava CT-2.5 — leitura pura, fail-closed no consumidor. */
export const fetchAtivoEdicaoPermitida = async (
  equipamentoId: string,
): Promise<CtAtivoEdicaoPermitida> => {
  const d = asRecord(
    await rpc("fn_ct_ativo_edicao_permitida", { p_equipamento_id: equipamentoId }),
  );
  return {
    ok: true,
    permitida: d.permitida === true,
    motivo: texto(d.motivo),
    compromissoStatus: texto(d.compromisso_status),
    periodoInicio: texto(d.periodo_inicio),
    periodoFim: texto(d.periodo_fim),
    exigeJustificativa: d.exige_justificativa === true,
  };
};
