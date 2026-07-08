import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  atualizarOrdemDiariaRascunho,
  buscarOrdemDiaria,
  cancelarOrdemDiaria,
  emitirOrdemDiaria,
  gerarOrdemDiariaRascunho,
  isDuplicidadeOrdemDiaria,
  listarOrdensDiarias,
  type AtualizarRascunhoInput,
  type GerarRascunhoInput,
  type ListarOrdensFiltros,
} from "@/services/planejamentoMacro/ordemDiariaService";


const KEYS = {
  lista: (f: ListarOrdensFiltros) => ["ordens-diarias", f] as const,
  detalhe: (id: string | null) => ["ordem-diaria", id] as const,
};

export function useOrdensDiarias(filtros: ListarOrdensFiltros) {
  return useQuery({
    queryKey: KEYS.lista(filtros),
    enabled: !!filtros.centroCustoId,
    staleTime: 15_000,
    queryFn: () => listarOrdensDiarias(filtros),
  });
}

export function useOrdemDiaria(ordemId: string | null) {
  return useQuery({
    queryKey: KEYS.detalhe(ordemId),
    enabled: !!ordemId,
    staleTime: 15_000,
    queryFn: () => buscarOrdemDiaria(ordemId as string),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["ordens-diarias"] });
    qc.invalidateQueries({ queryKey: ["ordem-diaria"] });
  };
}

export function useGerarOrdemDiariaRascunho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: GerarRascunhoInput) => gerarOrdemDiariaRascunho(input),
    onSuccess: () => {
      invalidate();
      toast.success("Rascunho de Ordem Diária criado.");
    },
    onError: (err: unknown) => {
      // Duplicidade é resolvida no chamador (modal abre a ordem existente).
      if (isDuplicidadeOrdemDiaria(err)) return;
      const msg = err instanceof Error ? err.message : "Erro ao gerar Ordem Diária";
      // FASE A: mensagem retroativa vem pronta do backend — repassar tal qual.
      toast.error(msg);
    },
  });
}

export function useAtualizarOrdemDiariaRascunho() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AtualizarRascunhoInput) => atualizarOrdemDiariaRascunho(input),
    onSuccess: () => {
      invalidate();
      toast.success("Rascunho atualizado.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar rascunho";
      toast.error(msg);
    },
  });
}

export function useEmitirOrdemDiaria() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ordemId: string) => emitirOrdemDiaria(ordemId),
    onSuccess: () => {
      invalidate();
      toast.success("Ordem Diária emitida.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao emitir Ordem Diária";
      toast.error(msg);
    },
  });
}

export function useCancelarOrdemDiaria() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ ordemId, motivo }: { ordemId: string; motivo: string }) =>
      cancelarOrdemDiaria(ordemId, motivo),
    onSuccess: () => {
      invalidate();
      toast.success("Ordem Diária cancelada.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao cancelar Ordem Diária";
      toast.error(msg);
    },
  });
}
