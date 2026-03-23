import { supabase } from '@/integrations/supabase/client';

export async function iniciarFluxoDinamico(solicitacaoId: string) {
  const { error } = await supabase.rpc('iniciar_fluxo_dinamico', {
    p_solicitacao_id: solicitacaoId,
  } as any);
  if (error) throw error;
}

export async function aprovarEtapaDinamica(
  solicitacaoId: string,
  etapaExecId: string,
  observacao?: string
) {
  const { error } = await supabase.rpc('aprovar_etapa_dinamica', {
    p_solicitacao_id: solicitacaoId,
    p_etapa_exec_id: etapaExecId,
    p_observacao: observacao || null,
  } as any);
  if (error) throw error;
}

export async function rejeitarEtapaDinamica(
  solicitacaoId: string,
  etapaExecId: string,
  observacao?: string
) {
  const { error } = await supabase.rpc('rejeitar_etapa_dinamica', {
    p_solicitacao_id: solicitacaoId,
    p_etapa_exec_id: etapaExecId,
    p_observacao: observacao || null,
  } as any);
  if (error) throw error;
}

export interface EtapaExecucao {
  id: string;
  solicitacao_id: string;
  etapa_id: string | null;
  etapa_nome_snapshot: string | null;
  ordem: number | null;
  status: string | null;
  pode_aprovar: boolean | null;
  usuario_id: string | null;
  data_aprovacao: string | null;
  observacao: string | null;
  fluxo_versao: number | null;
  created_at: string | null;
}

export async function getEtapasExecucao(solicitacaoId: string): Promise<EtapaExecucao[]> {
  const { data, error } = await supabase
    .from('bd_aprovacoes_fluxo_exec')
    .select('*')
    .eq('solicitacao_id', solicitacaoId)
    .order('ordem', { ascending: true });
  if (error) throw error;
  return (data || []) as EtapaExecucao[];
}
