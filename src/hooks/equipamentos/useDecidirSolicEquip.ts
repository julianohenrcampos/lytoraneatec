import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface DecidirEquipInput {
  solicitacaoId: string;
  decisao: 'APROVADO' | 'NEGADO';
  comentario?: string | null;
}

interface DecidirEquipResult {
  ok?: boolean;
  status?: string;
  status_fluxo?: string;
  [key: string]: unknown;
}

export function useDecidirSolicEquip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecidirEquipInput): Promise<DecidirEquipResult> => {
      const { data, error } = await supabase.rpc(
        'fn_solic_equip_decidir' as any,
        {
          p_solicitacao_id: input.solicitacaoId,
          p_decisao: input.decisao,
          p_comentario: input.comentario ?? null,
        } as any,
      );
      if (error) throw error;
      return (data ?? {}) as DecidirEquipResult;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['central-aprovacoes:equipamentos:list'] });
      qc.invalidateQueries({ queryKey: ['central-aprovacoes:equipamentos:minha-acao-count'] });
      qc.invalidateQueries({ queryKey: ['central-aprovacoes', 'equipamentos', 'detalhe', variables.solicitacaoId] });
      toast.success(variables.decisao === 'APROVADO' ? 'Solicitação aprovada.' : 'Solicitação negada.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao processar decisão';
      toast.error(msg);
    },
  });
}
