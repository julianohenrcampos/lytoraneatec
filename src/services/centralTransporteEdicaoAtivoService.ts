/**
 * CT-2.5 — Consulta da trava de edição da condição operacional do ativo.
 *
 * A decisão final é SEMPRE do servidor (a RPC de upsert repete a verificação).
 * Esta leitura serve apenas para antecipar o bloqueio na interface e pedir a
 * justificativa de exceção antes do envio.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CtAtivoEdicaoPermitida } from "@/types/centralTransporteMobilizacao";

export const fetchAtivoEdicaoPermitida = async (
  equipamentoId: string,
): Promise<CtAtivoEdicaoPermitida> => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- fronteira supabase.rpc */
  const { data, error } = await (supabase as any).rpc("fn_ct_ativo_edicao_permitida", {
    p_equipamento_id: equipamentoId,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("CT2_RESPOSTA_INVALIDA");
  }

  const r = data as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

  return {
    ok: true,
    permitida: r.permitida === true,
    motivo: str(r.motivo),
    compromissoStatus: str(r.compromisso_status),
    periodoInicio: str(r.periodo_inicio),
    periodoFim: str(r.periodo_fim),
    exigeJustificativa: r.exige_justificativa === true,
  };
};
