// =====================================================
// useEscopoCentrosCusto
// Hook frontend puro (sem nova RPC, sem tabela, sem RLS).
// Determina o escopo de centros de custo do usuário para
// uso em features que NÃO têm fonte própria de escopo
// (ex.: Agendamento de Exames).
//
// Regra:
//  - Usuário GLOBAL (SuperAdm + perfis SSO globais menos AdmOBRA)
//    => isGlobal=true, listas vazias.
//  - AdmOBRA / demais => união de:
//      1) centro_custo_id do funcionário vinculado ao profile;
//      2) centros retornados por fn_diaria_scope_centros_custo(user_id).
//    (Reuso temporário; sem fonte dedicada de RH ainda.)
//
// Expõe SEMPRE arrays ordenados (não Sets) para uso seguro em
// queryKey/dependências sem refetch em loop.
// =====================================================

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import { logLegacyUsage } from '@/utils/rbacLegacyTelemetry';

/**
 * Roles consideradas "globais" para Agendamento de Exames.
 * Derivadas de has_sso_full_access (banco), removendo AdmOBRA
 * (que é justamente o perfil que precisa ser restringido).
 *
 * Confirmadas no banco:
 *  - bd_roles.nome: SuperAdm, AdmtreinoSSO, TecEnferSSO, ConsultaExames
 *  - profiles.funcoes (legado): AdmSSO
 */
const GLOBAL_ROLES_EXAMES = [
  'SuperAdm',
  'AdmSSO',
  'TecEnferSSO',
  'ConsultaExames',
  'AdmtreinoSSO',
] as const;

const GLOBAL_ROLES_NORMALIZED = new Set(
  GLOBAL_ROLES_EXAMES.map((r) => r.toUpperCase().trim()),
);

const norm = (s: unknown) =>
  typeof s === 'string' ? s.toUpperCase().trim() : '';

export interface EscopoCentrosCusto {
  isGlobal: boolean;
  allowedCentroIds: string[]; // ordenado
  allowedNomes: string[]; // ordenado
  /**
   * Variações de `contrato` (texto livre em bd_agendamentos_exames e similares)
   * que correspondem aos CCs do escopo. Inclui o nome puro e o formato
   * legado "CODIGO - NOME" para casar registros antigos.
   */
  allowedContratos: string[]; // ordenado
  isLoading: boolean;
}

const EMPTY_GLOBAL: EscopoCentrosCusto = {
  isGlobal: true,
  allowedCentroIds: [],
  allowedNomes: [],
  allowedContratos: [],
  isLoading: false,
};

const EMPTY_RESTRITO: EscopoCentrosCusto = {
  isGlobal: false,
  allowedCentroIds: [],
  allowedNomes: [],
  allowedContratos: [],
  isLoading: false,
};


export function useEscopoCentrosCusto(): EscopoCentrosCusto {
  const { userId, isSuperAdmin, isLoading: isLoadingPerm } = usePermission();

  const query = useQuery({
    queryKey: ['escopo-cc', userId],
    enabled: !!userId && !isLoadingPerm,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    queryFn: async (): Promise<EscopoCentrosCusto> => {
      if (!userId) return EMPTY_RESTRITO;

      // SuperAdm = global imediato
      if (isSuperAdmin) return EMPTY_GLOBAL;

      // 1) Coleta roles (profile.funcoes + bd_user_roles → bd_roles.nome)
      const [profileRes, userRolesRes] = await Promise.allSettled([
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

      const profile =
        profileRes.status === 'fulfilled' ? (profileRes.value.data as any) : null;

      const funcoesProfile: string[] = Array.isArray(profile?.funcoes)
        ? (profile!.funcoes as string[])
        : [];

      if (funcoesProfile.length > 0) {
        logLegacyUsage('RBAC_LEGACY_SCOPE_FALLBACK_USED', {
          userId,
          hook: 'useEscopoCentrosCusto',
          rolesCount: funcoesProfile.length,
        });
      }

      const rolesFromDb: string[] =
        userRolesRes.status === 'fulfilled'
          ? ((userRolesRes.value.data as any[]) || [])
              .map((r: any) => r?.bd_roles?.nome)
              .filter(Boolean)
          : [];

      const rolesEfetivasNorm = new Set(
        [...funcoesProfile, ...rolesFromDb].map(norm).filter(Boolean),
      );

      const isGlobal = Array.from(rolesEfetivasNorm).some((r) =>
        GLOBAL_ROLES_NORMALIZED.has(r),
      );

      if (isGlobal) return EMPTY_GLOBAL;

      // 2) Restrito: une CC vinculado ao funcionário do profile + fn_diaria_scope_centros_custo
      const funcionarioId: string | null = profile?.funcionario_id || null;

      const [vinculoRes, diariaScopeRes] = await Promise.allSettled([
        funcionarioId
          ? supabase
              .from('bd_funcionarios')
              .select('centro_custo_id')
              .eq('id', funcionarioId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        supabase.rpc('fn_diaria_scope_centros_custo' as any, {
          p_user_id: userId,
        } as any),
      ]);

      const ids = new Set<string>();

      if (vinculoRes.status === 'fulfilled') {
        const cc = (vinculoRes.value as any)?.data?.centro_custo_id as
          | string
          | null
          | undefined;
        if (cc) ids.add(cc);
      } else {
        console.warn('[useEscopoCentrosCusto] vínculo CC falhou', vinculoRes);
      }

      if (
        diariaScopeRes.status === 'fulfilled' &&
        !(diariaScopeRes.value as any).error
      ) {
        const rows = ((diariaScopeRes.value as any).data as any[]) || [];
        rows.forEach((r: any) => {
          const id =
            typeof r === 'string'
              ? r
              : r?.fn_diaria_scope_centros_custo ?? r?.id ?? r?.centro_custo_id;
          if (id) ids.add(id);
        });
      } else {
        console.warn(
          '[useEscopoCentrosCusto] fn_diaria_scope_centros_custo falhou',
          diariaScopeRes,
        );
      }

      const allowedCentroIds = Array.from(ids).sort();

      let allowedNomes: string[] = [];
      let allowedContratos: string[] = [];
      if (allowedCentroIds.length > 0) {
        const { data: ccData, error: ccErr } = await supabase
          .from('bd_centros_custo')
          .select('id, nome_centro_custo, codigo_centro_custo')
          .in('id', allowedCentroIds);
        if (!ccErr && ccData) {
          const nomesSet = new Set<string>();
          const contratosSet = new Set<string>();
          (ccData as any[]).forEach((c: any) => {
            const nome = (c?.nome_centro_custo ?? '').toString().trim();
            const codigo = (c?.codigo_centro_custo ?? '').toString().trim();
            if (nome) {
              nomesSet.add(nome);
              contratosSet.add(nome);
              if (codigo) contratosSet.add(`${codigo} - ${nome}`);
            }
          });
          allowedNomes = Array.from(nomesSet).sort();
          allowedContratos = Array.from(contratosSet).sort();
        }
      }

      return {
        isGlobal: false,
        allowedCentroIds,
        allowedNomes,
        allowedContratos,
        isLoading: false,
      };
    },
  });

  return useMemo<EscopoCentrosCusto>(() => {
    if (isLoadingPerm || query.isLoading) {
      return {
        isGlobal: false,
        allowedCentroIds: [],
        allowedNomes: [],
        allowedContratos: [],
        isLoading: true,
      };
    }
    return query.data ?? EMPTY_RESTRITO;
  }, [isLoadingPerm, query.isLoading, query.data]);
}

