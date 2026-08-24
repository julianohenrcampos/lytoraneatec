/**
 * CT-5 — Serviço de Puxadas, exclusivamente via RPCs fail-closed.
 *
 * Nenhuma escrita direta em tabela: caminhões/motoristas são reconstruídos de
 * forma determinística pelo servidor e todo comando é idempotente por
 * request_id (ledger bd_ct_comando_requests).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CtMotoristaOperacional,
  CtPuxada,
  CtPuxadaCancelamentoResult,
  CtPuxadaComandoResult,
  CtPuxadaRascunho,
  CtPuxadaStatus,
} from "@/types/centralTransportePuxada";
import { montarPayloadPuxada } from "@/lib/central-transporte/puxadaRascunho";

/* eslint-disable @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (RPCs CT-5 não tipadas) */
const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const asRecord = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("CT5_RESPOSTA_INVALIDA");
  return v as Record<string, unknown>;
};

const texto = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const numero = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

const ponto = (v: unknown) => {
  const r = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    endereco: texto(r.endereco),
    latitude: numero(r.latitude),
    longitude: numero(r.longitude),
  };
};

const geometria = (
  v: unknown,
): { type: "LineString"; coordinates: [number, number][] } | null => {
  if (!v || typeof v !== "object") return null;
  const g = v as { type?: unknown; coordinates?: unknown };
  if (g.type !== "LineString" || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
    return null;
  }
  return { type: "LineString", coordinates: g.coordinates as [number, number][] };
};

export const mapPuxada = (raw: unknown): CtPuxada => {
  const r = asRecord(raw);
  const rota = r.rota && typeof r.rota === "object" ? (r.rota as Record<string, unknown>) : {};
  const caminhoes = Array.isArray(r.caminhoes) ? r.caminhoes : [];
  return {
    id: String(r.id),
    codigo: texto(r.codigo),
    status: (texto(r.status) ?? "RASCUNHO") as CtPuxadaStatus,
    dataPuxada: texto(r.data_puxada),
    centroCustoId: texto(r.centro_custo_id),
    ccCodigo: texto(r.cc_codigo),
    ccNome: texto(r.cc_nome),
    planejadorNome: texto(r.planejador_nome),
    coleta: ponto(r.coleta),
    descarga: ponto(r.descarga),
    distanciaRotaKm: numero(rota.distancia_km),
    duracaoRotaMin: numero(rota.duracao_min),
    rotaResumo: texto(rota.resumo),
    rotaGeometria: geometria(rota.geometria),
    observacoes: texto(r.observacoes),
    programadaEm: texto(r.programada_em),
    canceladoEm: texto(r.cancelado_em),
    motivoCancelamento: texto(r.motivo_cancelamento),
    caminhoes: caminhoes.map((c) => {
      const x = asRecord(c);
      return {
        id: String(x.id),
        caminhaoEquipamentoId: String(x.caminhao_equipamento_id),
        frota: texto(x.frota),
        placa: texto(x.placa),
        motoristaFuncionarioId: texto(x.motorista_funcionario_id),
        motoristaNome: texto(x.motorista_nome),
      };
    }),
    totalCaminhoes: numero(r.total_caminhoes) ?? caminhoes.length,
  };
};

const mapComando = (raw: unknown): CtPuxadaComandoResult => {
  const d = asRecord(raw);
  return {
    ok: true,
    replay: d.replay === true,
    puxadaId: String(d.puxada_id),
    puxada: d.puxada ? mapPuxada(d.puxada) : null,
  };
};

/* ------------------------------ leituras ------------------------------ */

export interface PuxadaListarFiltros {
  status?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  centroCustoId?: string | null;
}

export const fetchPuxadas = async (
  filtros: PuxadaListarFiltros = {},
): Promise<CtPuxada[]> => {
  const d = asRecord(
    await rpc("fn_ct_puxada_listar", {
      p_status: filtros.status ?? null,
      p_data_inicio: filtros.dataInicio ?? null,
      p_data_fim: filtros.dataFim ?? null,
      p_centro_custo_id: filtros.centroCustoId ?? null,
    }),
  );
  return Array.isArray(d.puxadas) ? d.puxadas.map(mapPuxada) : [];
};

export const fetchPuxada = async (puxadaId: string): Promise<CtPuxada> =>
  mapPuxada(await rpc("fn_ct_puxada_json", { p_puxada_id: puxadaId }));

/** Motoristas habilitados — RPC autoritativa (não depende de RBAC de RH). */
export const fetchMotoristasOperacionais = async (): Promise<CtMotoristaOperacional[]> => {
  const data = await rpc("fn_motoristas_operacional_lookup", {});
  if (!Array.isArray(data)) return [];
  return data.map((raw) => {
    const r = asRecord(raw);
    return {
      id: String(r.id),
      nomeCompleto: texto(r.nome_completo) ?? "Sem nome",
      matricula: texto(r.matricula),
      funcaoNome: texto(r.funcao_nome),
    };
  });
};

/* ------------------------------ escritas ------------------------------ */

export const salvarRascunhoPuxada = async (
  rascunho: CtPuxadaRascunho,
  requestId: string,
): Promise<CtPuxadaComandoResult> =>
  mapComando(
    await rpc("fn_ct_puxada_salvar_rascunho", {
      p_puxada_id: rascunho.puxadaId,
      p_payload: montarPayloadPuxada(rascunho),
      p_request_id: requestId,
    }),
  );

export const programarPuxada = async (
  puxadaId: string,
  requestId: string,
): Promise<CtPuxadaComandoResult> =>
  mapComando(
    await rpc("fn_ct_puxada_programar", {
      p_puxada_id: puxadaId,
      p_request_id: requestId,
    }),
  );

export const cancelarPuxada = async (
  puxadaId: string,
  motivo: string,
  requestId: string,
): Promise<CtPuxadaCancelamentoResult> => {
  const d = asRecord(
    await rpc("fn_ct_puxada_cancelar", {
      p_puxada_id: puxadaId,
      p_motivo: motivo,
      p_request_id: requestId,
    }),
  );
  return {
    ok: true,
    replay: d.replay === true,
    puxadaId: String(d.puxada_id ?? puxadaId),
    status: (texto(d.status) ?? "CANCELADA") as CtPuxadaStatus,
    motivo: texto(d.motivo),
  };
};
