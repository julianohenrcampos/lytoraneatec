import { supabase } from "@/integrations/supabase/client";
import { getConfiguracaoSistema } from "@/services/configService";
import type { AprovacaoCorporativaStatus, ProcessoTipo } from "@/types/fluxoAprovacao";

/**
 * Camada de acesso ao core corporativo de aprovação.
 * A autoridade é sempre do banco; o frontend apenas apresenta.
 * A decisão de etapa NÃO é exposta aqui: ela ocorre por wrapper de domínio.
 */

export async function isMotorAprovacaoCorporativoAtivo(): Promise<boolean> {
  const valor = await getConfiguracaoSistema("motor_aprovacao_corporativo_ativo");
  return valor === "true";
}

export async function iniciarAprovacaoCorporativa(params: {
  processoTipo: ProcessoTipo;
  processoId: string;
  centroCustoId: string | null;
  contexto?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("fn_aprovacao_corporativa_iniciar" as any, {
    p_processo_tipo: params.processoTipo,
    p_processo_id: params.processoId,
    p_centro_custo_id: params.centroCustoId,
    p_contexto: params.contexto ?? {},
  } as any);
  if (error) throw error;
  return (data as Record<string, unknown>) || {};
}

export async function getAprovacaoCorporativaStatus(
  processoTipo: ProcessoTipo,
  processoId: string
): Promise<AprovacaoCorporativaStatus> {
  const { data, error } = await supabase.rpc("fn_aprovacao_corporativa_status" as any, {
    p_processo_tipo: processoTipo,
    p_processo_id: processoId,
  } as any);
  if (error) throw error;
  return data as unknown as AprovacaoCorporativaStatus;
}
