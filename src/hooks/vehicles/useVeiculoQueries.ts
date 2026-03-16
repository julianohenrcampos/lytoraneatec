import { useQuery } from "@tanstack/react-query";
import { 
  fetchVeiculos,
  getDepartamentosDropdown,
  getFabricantesDropdown,
  getEmpresasDropdown,
  getCategoriasDropdown,
  getSubcategoriasDropdown,
  VeiculoFilter
} from "@/services/veiculo";

export const useVeiculoQueries = (filters: VeiculoFilter = {}) => {
  const { 
    data: veiculos, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery({
    queryKey: ['veiculos', filters],
    queryFn: () => fetchVeiculos(filters),
    retry: 1,
    staleTime: 30000,
  });

  const { data: departamentosDropdown, isLoading: isLoadingDepartamentos } = useQuery({
    queryKey: ['departamentosDropdown'],
    queryFn: () => getDepartamentosDropdown(),
    retry: 1,
    staleTime: 60000,
  });

  const { data: fabricantesDropdown, isLoading: isLoadingFabricantes } = useQuery({
    queryKey: ['fabricantesDropdown'],
    queryFn: () => getFabricantesDropdown(),
    retry: 1,
    staleTime: 60000,
  });

  const { data: empresasDropdown, isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ['empresasDropdown'],
    queryFn: () => getEmpresasDropdown(),
    retry: 1,
    staleTime: 60000,
  });

  const { data: categoriasDropdown, isLoading: isLoadingCategorias } = useQuery({
    queryKey: ['categoriasDropdown'],
    queryFn: () => getCategoriasDropdown(),
    retry: 1,
    staleTime: 60000,
  });

  return {
    veiculos: veiculos || [],
    isLoading,
    isError,
    refetch,
    departamentosDropdown: departamentosDropdown || [],
    isLoadingDepartamentos,
    fabricantesDropdown: fabricantesDropdown || [],
    isLoadingFabricantes,
    empresasDropdown: empresasDropdown || [],
    isLoadingEmpresas,
    categoriasDropdown: categoriasDropdown || [],
    isLoadingCategorias,
    // Keep backward compat
    marcasDropdown: fabricantesDropdown || [],
    isLoadingMarcas: isLoadingFabricantes,
  };
};

export const useSubcategoriasQuery = (categoriaId?: string | null) => {
  const { data: subcategoriasDropdown, isLoading: isLoadingSubcategorias } = useQuery({
    queryKey: ['subcategoriasDropdown', categoriaId],
    queryFn: () => getSubcategoriasDropdown(categoriaId || undefined),
    enabled: !!categoriaId && categoriaId !== '_none',
    retry: 1,
    staleTime: 60000,
  });

  return {
    subcategoriasDropdown: subcategoriasDropdown || [],
    isLoadingSubcategorias,
  };
};
