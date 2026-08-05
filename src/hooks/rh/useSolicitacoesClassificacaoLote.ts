import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as svc from '@/services/rh/solicitacoesClassificacaoLoteService';
import { toast } from 'sonner';

const KEY = ['solicitacoes-classificacao-lote'];

export function useSolicitacoesClassificacaoLote() {
  return useQuery({
    queryKey: KEY,
    queryFn: svc.listarSolicitacoesClassificacaoLote,
  });
}

export function useSolicitacaoClassificacaoLote(id: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, id, 'detalhe'],
    queryFn: async () => {
      const [header, itens] = await Promise.all([
        svc.obterSolicitacaoClassificacaoLote(id!),
        svc.listarItensDoLote(id!),
      ]);
      return { header, itens };
    },
    enabled: !!id,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

export function useCriarRascunhoClassificacaoLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { observacoes?: string | null }) =>
      svc.criarRascunhoClassificacaoLote(input),
    onSuccess: () => {
      invalidate(qc);
      toast.success('Rascunho criado.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao criar rascunho.'),
  });
}

export function useAtualizarObservacoesRascunho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes: string | null }) =>
      svc.atualizarObservacoesRascunho(id, observacoes),
    onSuccess: (_, vars) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: [...KEY, vars.id, 'detalhe'] });
      toast.success('Observações atualizadas.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao atualizar observações.'),
  });
}

export function useEmitirSolicitacaoClassificacaoLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: svc.EmitirSolicitacaoClassificacaoLoteInput) =>
      svc.emitirSolicitacaoClassificacaoLote(input),
    onSuccess: (id) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: [...KEY, id, 'detalhe'] });
      toast.success('Solicitação emitida com sucesso.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao emitir solicitação.'),
  });
}

export function useCancelarRascunhoVazio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string | null }) =>
      svc.cancelarRascunhoVazio(id, motivo),
    onSuccess: (_, vars) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: [...KEY, vars.id, 'detalhe'] });
      toast.success('Rascunho cancelado.');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao cancelar rascunho.'),
  });
}
