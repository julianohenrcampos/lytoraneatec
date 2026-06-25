import { useQuery } from "@tanstack/react-query";
import {
  buscarOrdemCampo,
  buscarItemCampo,
} from "@/services/ordemDiariaCampo/ordemCampoService";

export function useOrdemCampoDetalhe(ordemId: string | undefined) {
  return useQuery({
    queryKey: ["ordem-campo", "detalhe", ordemId],
    queryFn: () => buscarOrdemCampo(ordemId as string),
    enabled: !!ordemId,
    staleTime: 60 * 1000,
  });
}

export function useItemCampoDetalhe(itemId: string | undefined) {
  return useQuery({
    queryKey: ["ordem-campo", "item", itemId],
    queryFn: () => buscarItemCampo(itemId as string),
    enabled: !!itemId,
    staleTime: 60 * 1000,
  });
}
