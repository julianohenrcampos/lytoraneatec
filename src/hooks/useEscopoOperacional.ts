// =====================================================
// useEscopoOperacional — Hook central de escopo (Fase E2)
// -----------------------------------------------------
// Camada frontend de LEITURA. NÃO substitui RLS/RPC.
//
// Regras (ver docs/RBAC_ESCOPO_OPERACIONAL.md):
//  - SuperAdm / acesso_global → isGlobal=true (allowedCentroIds=[])
//  - Demais → consome public.fn_diaria_scope_centros_custo(p_user_id)
//  - Lista vazia → userScope='nenhum' (fail-closed)
//
// Este hook NÃO é importado por nenhuma tela nesta fase.
// Validação isolada em /dev/escopo-debug.
// =====================================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';

export type EscopoSource =
  | 'super_admin'
  | 'acesso_global'
  | 'fn_diaria_scope'
  | 'empty'
  | 'loading';

export type UserScope = 'global' | 'restrito' | 'nenhum';

export interface EscopoDebugInfo {
  userId: string | null;
  funcionarioId: string | null;
  rolesEfetivas: string[];
  rawScopeRows: number;
  timestamp: string;
}

export interface UseEscopoOperacionalResult {
  isGlobal: boolean;
  allowedCentroIds: string[];
  userScope: UserScope;
  isLoading: boolean;
  source?: EscopoSource;
  debugInfo?: EscopoDebugInfo;
}

const IS_DEV = import.meta.env.DEV;

const LOADING_RESULT: UseEscopoOperacionalResult = {
  isGlobal: false,
  allowedCentroIds: [],
  userScope: 'nenhum',
  isLoading: true,
  ...(IS_DEV ? { source: 'loading' as EscopoSource } : {}),
};

function normalizeRow(r: unknown): string | null {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') {
    const o = r as Record<string, unknown>;
    return (
      (o.fn_diaria_scope_centros_custo as string) ||
      (o.centro_custo_id as string) ||
      (o.id as string) ||
      null
    );
  }
  return null;
}

export function useEscopoOperacional(): UseEscopoOperacionalResult {
  const {
    userId,
    isSuperAdmin,
    isLoading: isLoadingPerm,
  } = usePermission();

  const query = useQuery({
    queryKey: ['escopo-operacional', userId, isSuperAdmin],
    enabled: !!userId && !isLoadingPerm,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<UseEscopoOperacionalResult> => {
      if (!userId) {
        return {
          isGlobal: false,
          allowedCentroIds: [],
          userScope: 'nenhum',
          isLoading: false,
          ...(IS_DEV ? { source: 'empty' as EscopoSource } : {}),
        };
      }

      // Bypass global (SuperAdm cobre acesso_global pelo próprio usePermission)
      if (isSuperAdmin) {
        let debugInfo: EscopoDebugInfo | undefined;
        if (IS_DEV) {
          debugInfo = {
            userId,
            funcionarioId: null,
            rolesEfetivas: ['SuperAdm/acesso_global'],
            rawScopeRows: 0,
            timestamp: new Date().toISOString(),
          };
        }
        return {
          isGlobal: true,
          allowedCentroIds: [],
          userScope: 'global',
          isLoading: false,
          ...(IS_DEV ? { source: 'super_admin' as EscopoSource, debugInfo } : {}),
        };
      }

      // Consome RPC oficial
      const { data, error } = await supabase.rpc(
        'fn_diaria_scope_centros_custo' as any,
        { p_user_id: userId } as any,
      );

      if (error) {
        console.warn('[useEscopoOperacional] fn_diaria_scope_centros_custo erro', error);
        return {
          isGlobal: false,
          allowedCentroIds: [],
          userScope: 'nenhum',
          isLoading: false,
          ...(IS_DEV ? { source: 'empty' as EscopoSource } : {}),
        };
      }

      const rows = Array.isArray(data) ? data : [];
      const ids = Array.from(
        new Set(
          rows.map(normalizeRow).filter((v): v is string => !!v),
        ),
      ).sort();

      let debugInfo: EscopoDebugInfo | undefined;
      if (IS_DEV) {
        // Roles efetivas (não-bloqueante) para diagnóstico
        let rolesEfetivas: string[] = [];
        let funcionarioId: string | null = null;
        try {
          const [profileRes, rolesRes] = await Promise.allSettled([
            supabase
              .from('profiles')
              .select('funcionario_id, funcoes')
              .eq('id', userId)
              .maybeSingle(),
            supabase
              .from('bd_user_roles')
              .select('bd_roles(nome)')
              .eq('user_id', userId),
          ]);
          if (profileRes.status === 'fulfilled') {
            const p = (profileRes.value as any).data;
            funcionarioId = p?.funcionario_id ?? null;
            const legacy: string[] = Array.isArray(p?.funcoes) ? p.funcoes : [];
            rolesEfetivas = [...legacy];
          }
          if (rolesRes.status === 'fulfilled') {
            const r = ((rolesRes.value as any).data ?? []) as any[];
            rolesEfetivas = [
              ...rolesEfetivas,
              ...r.map((x) => x?.bd_roles?.nome).filter(Boolean),
            ];
          }
        } catch {
          /* ignore */
        }
        debugInfo = {
          userId,
          funcionarioId,
          rolesEfetivas: Array.from(new Set(rolesEfetivas)),
          rawScopeRows: rows.length,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        isGlobal: false,
        allowedCentroIds: ids,
        userScope: ids.length === 0 ? 'nenhum' : 'restrito',
        isLoading: false,
        ...(IS_DEV
          ? {
              source: (ids.length === 0 ? 'empty' : 'fn_diaria_scope') as EscopoSource,
              debugInfo,
            }
          : {}),
      };
    },
  });

  return useMemo<UseEscopoOperacionalResult>(() => {
    if (isLoadingPerm || query.isLoading) return LOADING_RESULT;
    return query.data ?? LOADING_RESULT;
  }, [isLoadingPerm, query.isLoading, query.data]);
}
