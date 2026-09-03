import { useQuery } from "@tanstack/react-query";
import {
  buscarResumoQualidade,
  buscarPendencias,
  buscarEstruturaResponsabilidade,
  type QcFiltros,
} from "@/services/qualidadeCadastralService";

export function useQualidadeResumo(filtros: QcFiltros, enabled = true) {
  return useQuery({
    queryKey: ["qualidade-cadastral", "resumo", filtros],
    queryFn: () => buscarResumoQualidade(filtros),
    enabled,
    staleTime: 60_000,
  });
}

export function useQualidadePendencias(
  filtros: QcFiltros,
  page: number,
  pageSize: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["qualidade-cadastral", "pendencias", filtros, page, pageSize],
    queryFn: () => buscarPendencias(filtros, pageSize, (page - 1) * pageSize),
    enabled,
    staleTime: 60_000,
  });
}

export function useQualidadeEstrutura(filtros: QcFiltros, enabled = true) {
  return useQuery({
    queryKey: ["qualidade-cadastral", "estrutura", filtros],
    queryFn: () => buscarEstruturaResponsabilidade(filtros),
    enabled,
    staleTime: 60_000,
  });
}
