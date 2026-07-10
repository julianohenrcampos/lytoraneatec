import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarApontamentosDoItem,
  registrarApontamento,
  type RegistrarApontamentoInput,
} from "@/services/ordemDiariaCampo/apontamentoService";

export function useApontamentosItem(itemId: string | undefined) {
  return useQuery({
    queryKey: ["ordem-campo", "apontamentos", itemId],
    queryFn: () => listarApontamentosDoItem(itemId as string),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

export function useRegistrarApontamento(itemId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegistrarApontamentoInput) => registrarApontamento(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordem-campo", "apontamentos", itemId] });
      qc.invalidateQueries({ queryKey: ["ordem-campo"] });
    },
  });
}
