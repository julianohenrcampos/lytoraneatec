/**
 * CT-4 — Serviço da Movimentação Direta e das paradas, via RPCs fail-closed.
 *
 * Nenhuma escrita direta em tabela: viagem, paradas e movimentações são
 * reconstruídas de forma determinística pelo servidor e todo comando é
 * idempotente por request_id (ledger bd_ct_comando_requests).
 */
import { supabase } from "@/integrations/supabase/client";
import { mapOrdem } from "./ctMotoristaOrdensService";
import type { CtOrdemMotorista } from "@/types/centralTransporteMobilizacao";
import type {
  CtAtivoMovimentacao,
  CtMovDiretaComandoResult,
  CtMovDiretaRascunho,
  CtParadaChegadaResult,
} from "@/types/centralTransporteMovDireta";
import { montarPayloadRascunho } from "@/lib/central-transporte/movDiretaRascunho";
import { normalizarTermoBuscaAtivo } from "@/lib/central-transporte/normalizarTermoBuscaAtivo";


/* eslint-disable @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (RPCs CT-4 não tipadas) */
const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const asRecord = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("CT4_RESPOSTA_INVALIDA");
  return v as Record<string, unknown>;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

const mapAtivo = (raw: unknown): CtAtivoMovimentacao => {
  const r = asRecord(raw);
  return {
    equipamentoId: String(r.equipamento_id),
    frota: texto(r.frota),
    numeroFrota: texto(r.numero_frota),
    placa: texto(r.placa),
    tipoAtivo: texto(r.tipo_ativo),
    modelo: texto(r.modelo),
    centroCustoId: texto(r.centro_custo_id),
    centroCustoLabel: texto(r.centro_custo_label),
    statusOperacional: texto(r.status_operacional) ?? "SEM_REGISTRO",
    possuiRegistro: r.possui_registro === true,
    compromissoViagem: texto(r.compromisso_viagem),
    osManutencao: texto(r.os_manutencao),
    elegivel: r.elegivel === true,
    bloqueioMotivo: texto(r.bloqueio_motivo),
  };
};


const mapComando = (raw: unknown): CtMovDiretaComandoResult => {
  const d = asRecord(raw);
  return {
    ok: true,
    replay: d.replay === true,
    viagemId: String(d.viagem_id),
    viagem: d.viagem ? mapOrdem(d.viagem) : null,
  };
};

/* ------------------------------ leituras ------------------------------ */

export const fetchAtivosMovimentacao = async (
  termo: string | null = null,
): Promise<CtAtivoMovimentacao[]> => {
  try {
    const d = asRecord(
      /* Teto máximo já suportado pela RPC: a janela alfabética não pode esconder
         ativos elegíveis. Alcance total garantido pela busca por termo. */
      await rpc("fn_ct_ativos_movimentacao_listar", {
        p_termo: normalizarTermoBuscaAtivo(termo) || null,
        p_limit: 300,
      }),
    );
    return Array.isArray(d.ativos) ? d.ativos.map(mapAtivo) : [];
  } catch (e) {
    /* Erro técnico NUNCA vira "lista vazia": propaga para a UI diferenciar. */
    console.error("[CT4][ATIVOS_MOVIMENTACAO_LISTAR_ERROR]", {
      termo,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
};


export const fetchMovDiretas = async (
  status: string | null = null,
): Promise<CtOrdemMotorista[]> => {
  const d = asRecord(await rpc("fn_ct_mov_direta_listar", { p_status: status }));
  return Array.isArray(d.viagens) ? d.viagens.map(mapOrdem) : [];
};

export const fetchMovDiretaEstado = async (viagemId: string): Promise<CtOrdemMotorista> => {
  const d = asRecord(await rpc("fn_ct_mov_direta_estado", { p_viagem_id: viagemId }));
  return mapOrdem(d.viagem);
};

/* ------------------------------ escritas ------------------------------ */

export const salvarRascunhoMovDireta = async (
  rascunho: CtMovDiretaRascunho,
  requestId: string,
): Promise<CtMovDiretaComandoResult> => {
  const payload = montarPayloadRascunho(rascunho);
  return mapComando(
    await rpc("fn_ct_mov_direta_salvar_rascunho", {
      p_viagem_id: rascunho.viagemId,
      p_payload: payload,
      p_request_id: requestId,
    }),
  );
};

export const programarMovDireta = async (
  viagemId: string,
  requestId: string,
): Promise<CtMovDiretaComandoResult> =>
  mapComando(
    await rpc("fn_ct_mov_direta_programar", {
      p_viagem_id: viagemId,
      p_request_id: requestId,
    }),
  );

export const cancelarMovDireta = async (
  viagemId: string,
  motivo: string,
  requestId: string,
): Promise<CtMovDiretaComandoResult> =>
  mapComando(
    await rpc("fn_ct_mov_direta_cancelar", {
      p_viagem_id: viagemId,
      p_motivo: motivo,
      p_request_id: requestId,
    }),
  );

export const registrarChegadaParada = async (
  paradaId: string,
  requestId: string,
): Promise<CtParadaChegadaResult> => {
  const d = asRecord(
    await rpc("fn_ct_parada_registrar_chegada", {
      p_parada_id: paradaId,
      p_request_id: requestId,
    }),
  );
  return {
    ok: true,
    replay: d.replay === true,
    paradaId: String(d.parada_id ?? paradaId),
    status: texto(d.status) ?? "CHEGADA_REGISTRADA",
  };
};
