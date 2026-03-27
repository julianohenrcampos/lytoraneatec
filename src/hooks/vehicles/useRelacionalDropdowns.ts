import { useQuery } from "@tanstack/react-query";
import {
  getFrotasDropdown,
  getFabricantesRelacionalDropdown,
  getModelosDropdown,
  getTiposEquipamentoDropdown,
} from "@/services/veiculo/dropdownsRelacional";

export const useFrotasDropdown = () => {
  return useQuery({
    queryKey: ["frotas-dropdown"],
    queryFn: getFrotasDropdown,
  });
};

export const useFabricantesRelacionalDropdown = () => {
  return useQuery({
    queryKey: ["fabricantes-relacional-dropdown"],
    queryFn: getFabricantesRelacionalDropdown,
  });
};

export const useModelosDropdown = (fabricanteId?: string | null) => {
  return useQuery({
    queryKey: ["modelos-dropdown", fabricanteId],
    queryFn: () => getModelosDropdown(fabricanteId || undefined),
    enabled: !!fabricanteId && fabricanteId !== "_none",
  });
};

export const useTiposEquipamentoDropdown = () => {
  return useQuery({
    queryKey: ["tipos-equipamento-dropdown"],
    queryFn: getTiposEquipamentoDropdown,
  });
};
