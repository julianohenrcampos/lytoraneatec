// Hooks de dados do módulo POPs (react-query).

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listarPopsGestao,
  listarPopsVigentes,
  listarSetores,
  popsModuloDisponivel,
} from '@/services/popsService';

export const POPS_QUERY_KEYS = {
  gate: ['pops', 'gate'] as const,
  biblioteca: ['pops', 'biblioteca'] as const,
  gestao: ['pops', 'gestao'] as const,
  setores: ['pops', 'setores'] as const,
};

export function usePopsGate() {
  return useQuery({
    queryKey: POPS_QUERY_KEYS.gate,
    queryFn: popsModuloDisponivel,
    staleTime: 60_000,
  });
}

export function usePopsBiblioteca(enabled = true) {
  return useQuery({
    queryKey: POPS_QUERY_KEYS.biblioteca,
    queryFn: listarPopsVigentes,
    enabled,
  });
}

export function usePopsGestao(enabled = true) {
  return useQuery({
    queryKey: POPS_QUERY_KEYS.gestao,
    queryFn: listarPopsGestao,
    enabled,
  });
}

export function usePopsSetores(enabled = true) {
  return useQuery({
    queryKey: POPS_QUERY_KEYS.setores,
    queryFn: listarSetores,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useInvalidatePops() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['pops'] });
  };
}
