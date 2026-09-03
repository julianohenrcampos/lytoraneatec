/**
 * Hooks de leitura do Dashboard de Chamados Internos.
 * Nenhuma regra de autorização no cliente — o backend recusa fora do escopo.
 */
import { useQuery } from "@tanstack/react-query";
import * as svc from "@/services/chamadosInternosDashboardService";
import type { ChamadosDashFiltro } from "@/types/chamadosInternosDashboard";

export const CHAMADOS_DASH_KEYS = {
  root: ["chamados-internos", "dashboard"] as const,
  kpis: (f: ChamadosDashFiltro) => ["chamados-internos", "dashboard", "kpis", f] as const,
  series: (f: ChamadosDashFiltro) => ["chamados-internos", "dashboard", "series", f] as const,
  atendentes: (f: ChamadosDashFiltro) =>
    ["chamados-internos", "dashboard", "atendentes", f] as const,
  fila: (f: ChamadosDashFiltro) => ["chamados-internos", "dashboard", "fila", f] as const,

  solicitantes: (f: ChamadosDashFiltro) =>
    ["chamados-internos", "dashboard", "solicitantes", f] as const,
  podeVer: ["chamados-internos", "dashboard", "pode-ver"] as const,
};

/** Atualiza sempre ao abrir a página; sem botão manual de refresh. */
const COMUM = {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  refetchOnMount: "always",
} as const;


export function useChamadosDashPodeVer() {
  return useQuery({
    queryKey: CHAMADOS_DASH_KEYS.podeVer,
    queryFn: svc.podeVerDashboard,
    staleTime: 5 * 60_000,
  });
}

export function useChamadosDashKpis(f: ChamadosDashFiltro, enabled = true) {
  return useQuery({
    queryKey: CHAMADOS_DASH_KEYS.kpis(f),
    queryFn: () => svc.buscarKpis(f),
    enabled,
    ...COMUM,
  });
}

export function useChamadosDashSeries(f: ChamadosDashFiltro, enabled = true) {
  return useQuery({
    queryKey: CHAMADOS_DASH_KEYS.series(f),
    queryFn: () => svc.buscarSeries(f),
    enabled,
    ...COMUM,
  });
}

export function useChamadosDashAtendentes(f: ChamadosDashFiltro, enabled = true) {
  return useQuery({
    queryKey: CHAMADOS_DASH_KEYS.atendentes(f),
    queryFn: () => svc.buscarAtendentes(f),
    enabled,
    ...COMUM,
  });
}

export function useChamadosDashFilaRisco(f: ChamadosDashFiltro, enabled = true) {
  return useQuery({
    queryKey: CHAMADOS_DASH_KEYS.fila(f),
    queryFn: () => svc.buscarFilaRisco(f),
    enabled,
    ...COMUM,
  });
}


export function useChamadosDashSolicitantes(f: ChamadosDashFiltro, enabled = true) {
  return useQuery({
    queryKey: CHAMADOS_DASH_KEYS.solicitantes(f),
    queryFn: () => svc.buscarSolicitantes(f),
    enabled,
    ...COMUM,
  });
}
