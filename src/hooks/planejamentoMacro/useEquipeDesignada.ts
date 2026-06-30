// Hooks da Fase Equipe Designada.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  atualizarDesignacao,
  designarFuncionario,
  listarEquipeDesignadaPorAtividade,
  listarFuncionariosDisponiveis,
  removerDesignacao,
  type AtualizarDesignacaoPatch,
  type DesignarInput,
} from "@/services/planejamentoMacro/equipeDesignadaService";

const keyEquipe = (atividadeId: string) =>
  ["planejamento-macro-equipe-designada", atividadeId] as const;

export function useEquipeDesignadaPorAtividade(atividadeId: string | null | undefined) {
  return useQuery({
    queryKey: keyEquipe(atividadeId ?? ""),
    queryFn: () => listarEquipeDesignadaPorAtividade(atividadeId as string),
    enabled: !!atividadeId,
    staleTime: 15_000,
  });
}

export function useFuncionariosDisponiveisDesignacao(args: {
  atividadeId: string | null | undefined;
  incluirOutrosCc?: boolean;
  busca?: string;
  semanaInicio?: string;
  semanaFim?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      "planejamento-macro-funcionarios-disponiveis",
      args.atividadeId,
      args.incluirOutrosCc ?? false,
      args.busca ?? "",
      args.semanaInicio ?? "",
      args.semanaFim ?? "",
    ],
    queryFn: () =>
      listarFuncionariosDisponiveis({
        atividadeId: args.atividadeId as string,
        incluirOutrosCc: args.incluirOutrosCc,
        busca: args.busca,
        semanaInicio: args.semanaInicio,
        semanaFim: args.semanaFim,
      }),
    enabled: !!args.atividadeId && (args.enabled ?? true),
    staleTime: 10_000,
  });
}

export function useDesignarFuncionario(atividadeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DesignarInput) => designarFuncionario(input),
    onSuccess: () => {
      toast.success("Funcionário designado.");
      qc.invalidateQueries({ queryKey: keyEquipe(atividadeId) });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-funcionarios-disponiveis"] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao designar."),
  });
}

export function useRemoverDesignacao(atividadeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => removerDesignacao(id),
    onSuccess: () => {
      toast.success("Designação removida.");
      qc.invalidateQueries({ queryKey: keyEquipe(atividadeId) });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-funcionarios-disponiveis"] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao remover."),
  });
}

export function useAtualizarDesignacao(atividadeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AtualizarDesignacaoPatch }) =>
      atualizarDesignacao(id, patch),
    onSuccess: () => {
      toast.success("Designação atualizada.");
      qc.invalidateQueries({ queryKey: keyEquipe(atividadeId) });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao atualizar."),
  });
}
