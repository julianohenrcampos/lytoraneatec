/**
 * CT-3D — Ordens do motorista (bd_ct_viagens) via RPCs fail-closed.
 *
 * Nenhuma leitura direta de tabela: as duas RPCs resolvem o vínculo
 * auth.uid() → profiles.funcionario_id → bd_ct_viagens.motorista_id e só
 * devolvem viagens atribuídas ao próprio funcionário.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CtModalidade,
  CtOrigemFluxo,
  CtParadaCarga,
  CtParadaStatus,
  CtViagemParada,
  CtOrdemCarga,
  CtOrdemMotorista,
  CtOrdensMotoristaResultado,
  CtTipoTransporte,
  CtViagemStatus,
} from "@/types/centralTransporteMobilizacao";

/* eslint-disable @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (RPCs CT-3D não tipadas) */
const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const asRecord = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("CT2_RESPOSTA_INVALIDA");
  return v as Record<string, unknown>;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

const numero = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const mapCarga = (raw: unknown): CtOrdemCarga => {
  const r = asRecord(raw);
  return {
    equipamentoId: String(r.equipamento_id),
    frota: texto(r.frota),
    numeroFrota: texto(r.numero_frota),
    placa: texto(r.placa),
    movimentacaoId: texto(r.movimentacao_id),
    statusMovimentacao: texto(r.status_movimentacao),
    subcategoriaId: texto(r.subcategoria_id),
    subcategoriaNome: texto(r.subcategoria_nome),
    imagemUrl: texto(r.imagem_url),
    fabricanteNome: texto(r.fabricante_nome),
    anoFabricacao: numero(r.ano_fabricacao),
    tipoAtivo: texto(r.tipo_ativo),
    modelo: texto(r.modelo),
    paradaId: texto(r.parada_id),
  };
};

const mapParadaCarga = (raw: unknown): CtParadaCarga => {
  const r = asRecord(raw);
  return {
    movimentacaoId: texto(r.movimentacao_id),
    statusMovimentacao: texto(r.status_movimentacao),
    equipamentoId: String(r.equipamento_id),
    frota: texto(r.frota),
    numeroFrota: texto(r.numero_frota),
    placa: texto(r.placa),
    tipoAtivo: texto(r.tipo_ativo),
    modelo: texto(r.modelo),
  };
};

/** CT-4 — paradas da viagem, sempre na ordem devolvida pelo servidor. */
export const mapParada = (raw: unknown): CtViagemParada => {
  const r = asRecord(raw);
  return {
    id: String(r.id),
    ordem: numero(r.ordem) ?? 0,
    status: (texto(r.status) ?? "PENDENTE") as CtParadaStatus,
    centroCustoId: texto(r.centro_custo_id),
    ccCodigo: texto(r.cc_codigo),
    ccNome: texto(r.cc_nome),
    endereco: texto(r.endereco),
    pontoExato: texto(r.ponto_exato),
    latitude: numero(r.latitude),
    longitude: numero(r.longitude),
    dataPrevista: texto(r.data_prevista),
    horaPrevista: texto(r.hora_prevista),
    observacao: texto(r.observacao),
    recebedorPrevistoFuncionarioId: texto(r.recebedor_previsto_funcionario_id),
    recebedorPrevistoNome: texto(r.recebedor_previsto_nome),
    chegadaRegistradaEm: texto(r.chegada_registrada_em),
    concluidaEm: texto(r.concluida_em),
    cargas: Array.isArray(r.cargas) ? r.cargas.map(mapParadaCarga) : [],
  };
};

export const mapOrdem = (raw: unknown): CtOrdemMotorista => {
  const r = asRecord(raw);
  return {
    id: String(r.id),
    codigo: String(r.codigo ?? ""),
    status: (texto(r.status) ?? "PROGRAMADA") as CtViagemStatus,
    dataOrdem: texto(r.data_ordem),
    dataPrevistaSaida: texto(r.data_prevista_saida),
    dataPrevistaEntrega: texto(r.data_prevista_entrega),
    modalidade: texto(r.modalidade_deslocamento) as CtModalidade | null,
    tipoTransporte: texto(r.tipo_transporte) as CtTipoTransporte | null,
    motoristaNome: texto(r.motorista_nome_snapshot),
    motoristaId: texto(r.motorista_id),
    veiculoTransportadorId: texto(r.veiculo_transportador_id),
    empresaTransportadoraId: texto(r.empresa_transportadora_id),
    origemCentroCustoId: texto(r.origem_centro_custo_id),
    placaTransportador: texto(r.placa_transportador_snapshot),
    empresaTransportadora: texto(r.empresa_transportadora_nome_snapshot),
    origemCentroCusto: texto(r.origem_cc_nome_snapshot),
    origemEndereco: texto(r.origem_endereco),
    origemPontoExato: texto(r.origem_ponto_exato),
    origemLatitude: numero(r.origem_latitude),
    origemLongitude: numero(r.origem_longitude),
    destinoCentroCusto: texto(r.destino_cc_nome_snapshot),
    destinoEndereco: texto(r.destino_endereco),
    destinoPontoExato: texto(r.destino_ponto_exato),
    destinoLatitude: numero(r.destino_latitude),
    destinoLongitude: numero(r.destino_longitude),
    distanciaKm: numero(r.distancia_km),
    recebedorPrevistoNome: texto(r.recebedor_previsto_nome),
    recebedorPrevistoTelefone: texto(r.recebedor_previsto_telefone),
    observacoes: texto(r.observacoes),
    cargas: Array.isArray(r.cargas) ? r.cargas.map(mapCarga) : [],
    origemFluxo: (texto(r.origem_fluxo) ?? "SOLICITACAO") as CtOrigemFluxo,
    solicitacaoId: texto(r.solicitacao_id),
    paradas: Array.isArray(r.paradas) ? r.paradas.map(mapParada) : [],
  };
};

export const fetchMinhasOrdens = async (
  dataInicio: string | null = null,
  dataFim: string | null = null,
): Promise<CtOrdensMotoristaResultado> => {
  const d = asRecord(
    await rpc("fn_ct_motorista_ordens_listar", {
      p_data_inicio: dataInicio,
      p_data_fim: dataFim,
    }),
  );
  return {
    ok: true,
    vinculoFuncionario: d.vinculo_funcionario === true,
    hoje: texto(d.hoje),
    ordens: Array.isArray(d.ordens) ? d.ordens.map(mapOrdem) : [],
  };
};

export const fetchMinhaOrdem = async (viagemId: string): Promise<CtOrdemMotorista> => {
  const d = asRecord(await rpc("fn_ct_motorista_ordem_detalhe", { p_viagem_id: viagemId }));
  return mapOrdem(d.ordem);
};

/** Link de navegação externa (não grava nada). */
export const linkRotaExterna = (o: CtOrdemMotorista): string | null => {
  const destino =
    o.destinoLatitude !== null && o.destinoLongitude !== null
      ? `${o.destinoLatitude},${o.destinoLongitude}`
      : o.destinoEndereco;
  if (!destino) return null;
  const origem =
    o.origemLatitude !== null && o.origemLongitude !== null
      ? `${o.origemLatitude},${o.origemLongitude}`
      : o.origemEndereco;
  const params = new URLSearchParams({ api: "1", destination: destino });
  if (origem) params.set("origin", origem);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};
