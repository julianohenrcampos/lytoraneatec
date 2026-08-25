/**
 * useCentralAprovacoes — orquestra os providers de aprovação da Central.
 * Providers ativos: Diárias (sempre) e Equipamentos (gated por toggle runtime).
 */
import { useMemo } from 'react';
import { useDiariasCentralProvider } from '@/services/central-aprovacoes/diariasProvider';
import { useEquipamentosCentralProvider } from '@/services/central-aprovacoes/equipamentosProvider';
import { useDesmobilizacaoCentralProvider } from '@/services/central-aprovacoes/desmobilizacaoProvider';
import { useTransferenciasCentralProvider } from '@/services/central-aprovacoes/transferenciasProvider';
import { useConfiguracaoSistema } from '@/hooks/useConfiguracaoSistema';
import { usePermission } from '@/hooks/usePermission';
import type {
  CentralFiltrosBase,
  CentralProviderResult,
  CentralApprovalItem,
  CentralIndicadores,
  CentralModuleState,
  CentralModulo,
} from '@/services/central-aprovacoes/types';

function moduloAtivo(filtros: CentralFiltrosBase, mod: CentralModulo): boolean {
  if (!filtros.modulos || filtros.modulos.length === 0) return true;
  return filtros.modulos.includes(mod);
}

function dedupeByValue(opts: { value: string; label: string }[]): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const o of opts) if (o.value && !map.has(o.value)) map.set(o.value, o.label);
  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function sumOrKeep(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function useCentralAprovacoes(filtros: CentralFiltrosBase): CentralProviderResult {
  const configQuery = useConfiguracaoSistema('central_aprovacoes_equipamentos_ativo');
  const equipamentosEnabledConfig = configQuery.isSuccess && configQuery.data === 'true';

  const diariasAtivo = moduloAtivo(filtros, 'diarias');
  const equipamentosAtivo = moduloAtivo(filtros, 'equipamentos');
  const equipamentosEnabled = equipamentosEnabledConfig && equipamentosAtivo;

  const diarias = useDiariasCentralProvider(filtros);
  const equipamentos = useEquipamentosCentralProvider(filtros, { enabled: equipamentosEnabled });

  const desmobilizacaoAtivo = moduloAtivo(filtros, 'desmobilizacao');
  const desmobilizacao = useDesmobilizacaoCentralProvider(filtros, { enabled: desmobilizacaoAtivo });

  const { isSuperAdmin } = usePermission();
  const transfConfigQuery = useConfiguracaoSistema('transferencia_aprovacao_recebedor_ativo');
  const transfTesteQuery = useConfiguracaoSistema('transferencia_aprovacao_recebedor_teste_superadm');
  // Toggle global ON, ou modo teste ON + SuperAdm (validado server-side nas RPCs)
  const transferenciasEnabledConfig =
    (transfConfigQuery.isSuccess && transfConfigQuery.data === 'true') ||
    (transfTesteQuery.isSuccess && transfTesteQuery.data === 'true' && isSuperAdmin);
  const transferenciasAtivo = moduloAtivo(filtros, 'transferencias');
  const transferenciasEnabled = transferenciasEnabledConfig && transferenciasAtivo;
  const transferencias = useTransferenciasCentralProvider(filtros, { enabled: transferenciasEnabled });

  const providers = useMemo(() => {
    const list: { key: CentralModulo; provider: CentralProviderResult; active: boolean }[] = [];
    list.push({ key: 'diarias', provider: diarias, active: diariasAtivo });
    if (equipamentosEnabled) list.push({ key: 'equipamentos', provider: equipamentos, active: true });
    list.push({ key: 'desmobilizacao', provider: desmobilizacao, active: desmobilizacaoAtivo });
    if (transferenciasEnabled) list.push({ key: 'transferencias', provider: transferencias, active: true });
    return list;
  }, [diarias, equipamentos, desmobilizacao, transferencias, diariasAtivo, equipamentosEnabled, desmobilizacaoAtivo, transferenciasEnabled]);

  const itens: CentralApprovalItem[] = useMemo(() => {
    const combined: CentralApprovalItem[] = [];
    for (const p of providers) if (p.active) combined.push(...p.provider.itens);
    combined.sort((a, b) => {
      const ta = a.atualizadoEm ? Date.parse(a.atualizadoEm) : 0;
      const tb = b.atualizadoEm ? Date.parse(b.atualizadoEm) : 0;
      if (tb !== ta) return tb - ta;
      return a.id.localeCompare(b.id);
    });
    return combined;
  }, [providers]);

  const activeProviders = providers.filter((p) => p.active);
  const anyLoading = activeProviders.some((p) => p.provider.isLoading);
  const allError = activeProviders.length > 0 && activeProviders.every((p) => p.provider.isError);

  const isLoading = itens.length === 0 && anyLoading;
  const isError = itens.length === 0 && allError;

  const indicadores: CentralIndicadores = useMemo(() => {
    const acc: CentralIndicadores = {
      pendentes: null,
      urgentes: null,
      aguardandoMinhaAcao: null,
      concluidasHoje: null,
      tempoMedioHojeMin: null,
    };
    for (const p of activeProviders) {
      if (p.provider.isError) continue;
      const ind = p.provider.indicadores;
      acc.pendentes = sumOrKeep(acc.pendentes, ind.pendentes);
      acc.urgentes = sumOrKeep(acc.urgentes, ind.urgentes);
      acc.aguardandoMinhaAcao = sumOrKeep(acc.aguardandoMinhaAcao, ind.aguardandoMinhaAcao);
      acc.concluidasHoje = sumOrKeep(acc.concluidasHoje, ind.concluidasHoje);
      acc.tempoMedioHojeMin = sumOrKeep(acc.tempoMedioHojeMin, ind.tempoMedioHojeMin);
    }
    return acc;
  }, [activeProviders]);

  const moduleStates: Partial<Record<CentralModulo, CentralModuleState>> = useMemo(() => {
    const out: Partial<Record<CentralModulo, CentralModuleState>> = {};
    for (const p of providers) {
      const state = p.provider.moduleStates?.[p.key];
      if (state) out[p.key] = { ...state, enabled: p.active };
    }
    return out;
  }, [providers]);

  const centrosCustoOptions = useMemo(
    () => dedupeByValue(activeProviders.flatMap((p) => p.provider.centrosCustoOptions)),
    [activeProviders],
  );
  const solicitantesOptions = useMemo(
    () => dedupeByValue(activeProviders.flatMap((p) => p.provider.solicitantesOptions)),
    [activeProviders],
  );
  const statusOptions = useMemo(
    () => dedupeByValue(activeProviders.flatMap((p) => p.provider.statusOptions)),
    [activeProviders],
  );

  const refetch = () => { for (const p of activeProviders) p.provider.refetch(); };

  return {
    itens,
    indicadores,
    isLoading,
    isError,
    refetch,
    centrosCustoOptions,
    solicitantesOptions,
    statusOptions,
    moduleStates,
    hasMore: equipamentos.hasMore,
    isLoadingMore: equipamentos.isLoadingMore,
    loadMore: equipamentos.loadMore,
  };
}
