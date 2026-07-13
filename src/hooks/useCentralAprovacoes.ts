/**
 * useCentralAprovacoes — orquestra os providers de aprovação da Central.
 * Fase 1: apenas o provider de Diárias.
 */
import { useDiariasCentralProvider } from '@/services/central-aprovacoes/diariasProvider';
import type { CentralFiltrosBase, CentralProviderResult } from '@/services/central-aprovacoes/types';

export function useCentralAprovacoes(filtros: CentralFiltrosBase): CentralProviderResult {
  // Fase 1: passthrough do provider de Diárias.
  return useDiariasCentralProvider(filtros);
}
