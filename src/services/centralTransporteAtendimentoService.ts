/**
 * CT-2 / M4 — Service das RPCs de atendimento por item.
 *
 * Chama exclusivamente as 4 RPCs públicas do CT-2, com os nomes de parâmetro
 * exatos do contrato vivo. Nenhuma escrita direta em tabela.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CtAtendimentoListarResult,
  CtAtribuirResult,
  CtEncerrarResult,
  CtEncerramentoStatus,
  CtItemComAtendimentos,
  CtModalidade,
  CtSubstituirResult,
} from "@/types/centralTransporteCT2";

/* eslint-disable @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (tipos gerados não cobrem as RPCs CT-2) */
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

export const listarAtendimentos = async (
  solicitacaoId: string,
): Promise<CtAtendimentoListarResult> => {
  const data = asRecord(await rpc("fn_ct_atendimento_listar", { p_solicitacao_id: solicitacaoId }));
  const itens = Array.isArray(data.itens) ? (data.itens as CtItemComAtendimentos[]) : [];
  return {
    ok: true,
    solicitacao_id: String(data.solicitacao_id ?? solicitacaoId),
    itens,
  };
};

export interface AtribuirParams {
  solicitacaoItemId: string;
  equipamentoId: string;
  modalidade: CtModalidade;
  requestId: string;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  justificativaOverride?: string | null;
}

export const atribuirAtendimento = async (p: AtribuirParams): Promise<CtAtribuirResult> => {
  const data = asRecord(
    await rpc("fn_ct_atendimento_atribuir", {
      p_solicitacao_item_id: p.solicitacaoItemId,
      p_equipamento_id: p.equipamentoId,
      p_modalidade: p.modalidade,
      p_request_id: p.requestId,
      p_periodo_inicio: p.periodoInicio ?? null,
      p_periodo_fim: p.periodoFim ?? null,
      p_justificativa_override: p.justificativaOverride ?? null,
    }),
  );
  return { ...(data as unknown as CtAtribuirResult), replay: data.replay === true };
};

export interface EncerrarParams {
  atendimentoId: string;
  novoStatus: CtEncerramentoStatus;
  motivo: string;
  requestId: string;
}

export const encerrarAtendimento = async (p: EncerrarParams): Promise<CtEncerrarResult> => {
  const data = asRecord(
    await rpc("fn_ct_atendimento_encerrar", {
      p_atendimento_id: p.atendimentoId,
      p_novo_status: p.novoStatus,
      p_motivo: p.motivo,
      p_request_id: p.requestId,
    }),
  );
  return { ...(data as unknown as CtEncerrarResult), replay: data.replay === true };
};

export interface SubstituirParams {
  atendimentoId: string;
  novoEquipamentoId: string;
  modalidade: CtModalidade;
  motivo: string;
  requestId: string;
  justificativaOverride?: string | null;
}

export const substituirAtendimento = async (p: SubstituirParams): Promise<CtSubstituirResult> => {
  const data = asRecord(
    await rpc("fn_ct_atendimento_substituir", {
      p_atendimento_id: p.atendimentoId,
      p_novo_equipamento_id: p.novoEquipamentoId,
      p_modalidade: p.modalidade,
      p_motivo: p.motivo,
      p_request_id: p.requestId,
      p_justificativa_override: p.justificativaOverride ?? null,
    }),
  );
  return { ...(data as unknown as CtSubstituirResult), replay: data.replay === true };
};
