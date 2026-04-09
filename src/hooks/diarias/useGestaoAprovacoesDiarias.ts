import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';

export type GestaoFluxoRole = 'superadmin' | 'gerente_adm' | 'diretor_operacional' | 'diretor_adm' | 'viewer';

export interface GestaoAprovacoesFiltros {
  centro_custo_id?: string;
  status_fluxo?: string;
  tipo_envio?: string;
  solicitante_id?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
}

export interface GestaoKpis {
  aguardando_gerenteadm: number;
  aguardando_diretor_operacional: number;
  aguardando_diretor_adm: number;
  finalizadas: number;
}

export interface SolicitacaoGestao {
  id: string;
  numero_solicitacao: string;
  data_inicio: string;
  data_fim: string;
  centro_custo_id: string;
  valor_estimado_total: number | null;
  status: string;
  status_fluxo: string | null;
  etapa_atual: number | null;
  tipo_envio: string | null;
  motor_aprovacao: string;
  criado_por: string | null;
  updated_at: string | null;
  bd_centros_custo: {
    id: string;
    codigo_centro_custo: string;
    nome_centro_custo: string;
  } | null;
  profiles: {
    id: string;
    nome_completo: string;
  } | null;
}

const STATUS_FLUXO_ATIVOS = [
  'aguardando_aprovacao_gerenteadm',
  'aguardando_aprovacao_diretor_operacional',
  'aguardando_aprovacao_diretor_adm',
  'ajuste_solicitado_adm',
  'finalizado',
];

export function useGestaoAprovacoesDiarias(filtros: GestaoAprovacoesFiltros) {
  const { userId, isSuperAdmin, isLoading: isLoadingPerms } = usePermission();
  const [userFluxoRole, setUserFluxoRole] = useState<GestaoFluxoRole>('viewer');
  const [roleLoading, setRoleLoading] = useState(true);

  // Determine user's fluxo role via bd_user_roles
  useEffect(() => {
    if (isLoadingPerms || !userId) return;

    if (isSuperAdmin) {
      setUserFluxoRole('superadmin');
      setRoleLoading(false);
      return;
    }

    const fetchRole = async () => {
      setRoleLoading(true);
      try {
        const { data } = await supabase
          .from('bd_user_roles')
          .select('bd_roles(name)')
          .eq('user_id', userId);

        const roleNames = (data || []).map((r: any) => r.bd_roles?.name).filter(Boolean);

        if (roleNames.includes('DiretorAdm')) {
          setUserFluxoRole('diretor_adm');
        } else if (roleNames.includes('DiretorOperacional')) {
          setUserFluxoRole('diretor_operacional');
        } else if (roleNames.includes('GerenteAdm')) {
          setUserFluxoRole('gerente_adm');
        } else {
          // Fallback: check profiles.funcoes
          const { data: profile } = await supabase
            .from('profiles')
            .select('funcoes')
            .eq('id', userId)
            .single();
          
          const funcoes = (profile?.funcoes as string[]) || [];
          if (funcoes.includes('DiretorAdm')) setUserFluxoRole('diretor_adm');
          else if (funcoes.includes('DiretorOperacional')) setUserFluxoRole('diretor_operacional');
          else if (funcoes.includes('GerenteAdm')) setUserFluxoRole('gerente_adm');
          else if (funcoes.includes('AdmSSO') || funcoes.includes('AdmOBRA')) setUserFluxoRole('viewer');
          else setUserFluxoRole('viewer');
        }
      } catch {
        setUserFluxoRole('viewer');
      } finally {
        setRoleLoading(false);
      }
    };

    fetchRole();
  }, [userId, isSuperAdmin, isLoadingPerms]);

  // Auto status filter by role
  const autoStatusFilter = useMemo(() => {
    switch (userFluxoRole) {
      case 'gerente_adm': return 'aguardando_aprovacao_gerenteadm';
      case 'diretor_operacional': return 'aguardando_aprovacao_diretor_operacional';
      case 'diretor_adm': return 'aguardando_aprovacao_diretor_adm';
      default: return null; // superadmin/viewer see all
    }
  }, [userFluxoRole]);

  // Main query
  const queryResult = useQuery({
    queryKey: ['gestao-aprovacoes-diarias', filtros, autoStatusFilter, userFluxoRole],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select(`
          id,
          numero_solicitacao,
          data_inicio,
          data_fim,
          centro_custo_id,
          valor_estimado_total,
          status,
          status_fluxo,
          etapa_atual,
          tipo_envio,
          motor_aprovacao,
          criado_por,
          updated_at,
          bd_centros_custo(id, codigo_centro_custo, nome_centro_custo)
        `)
        .in('status_fluxo', STATUS_FLUXO_ATIVOS)
        .order('updated_at', { ascending: false });

      // Auto filter by role (non-superadmin)
      if (autoStatusFilter && !filtros.status_fluxo) {
        query = query.eq('status_fluxo', autoStatusFilter);
      }

      // UI filters
      if (filtros.status_fluxo) {
        query = query.eq('status_fluxo', filtros.status_fluxo);
      }
      if (filtros.centro_custo_id) {
        query = query.eq('centro_custo_id', filtros.centro_custo_id);
      }
      if (filtros.tipo_envio) {
        query = query.eq('tipo_envio', filtros.tipo_envio);
      }
      if (filtros.solicitante_id) {
        query = query.eq('criado_por', filtros.solicitante_id);
      }
      if (filtros.periodo_inicio) {
        query = query.gte('data_inicio', filtros.periodo_inicio);
      }
      if (filtros.periodo_fim) {
        query = query.lte('data_fim', filtros.periodo_fim);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch solicitante names separately
      const items = data || [];
      const criadorIds = [...new Set(items.map((i: any) => i.criado_por).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (criadorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome_completo')
          .in('id', criadorIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p.nome_completo; });
      }

      return items.map((item: any) => ({
        ...item,
        profiles: item.criado_por ? { id: item.criado_por, nome_completo: profilesMap[item.criado_por] || '-' } : null,
      })) as SolicitacaoGestao[];
    },
    enabled: !roleLoading && !isLoadingPerms,
  });

  // KPIs from ALL data (separate query without UI filters for accurate counts)
  const kpisQuery = useQuery({
    queryKey: ['gestao-aprovacoes-kpis', autoStatusFilter],
    queryFn: async () => {
      let query = supabase
        .from('bd_diaria_solicitacoes')
        .select('status_fluxo')
        .in('status_fluxo', STATUS_FLUXO_ATIVOS);

      const { data, error } = await query;
      if (error) throw error;

      const kpis: GestaoKpis = {
        aguardando_gerenteadm: 0,
        aguardando_diretor_operacional: 0,
        aguardando_diretor_adm: 0,
        finalizadas: 0,
      };

      (data || []).forEach((item: any) => {
        switch (item.status_fluxo) {
          case 'aguardando_aprovacao_gerenteadm': kpis.aguardando_gerenteadm++; break;
          case 'aguardando_aprovacao_diretor_operacional': kpis.aguardando_diretor_operacional++; break;
          case 'aguardando_aprovacao_diretor_adm': kpis.aguardando_diretor_adm++; break;
          case 'finalizado': kpis.finalizadas++; break;
        }
      });

      return kpis;
    },
    enabled: !roleLoading && !isLoadingPerms,
  });

  // Filter options
  const centrosCustoQuery = useQuery({
    queryKey: ['gestao-aprovacoes-ccs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('codigo_centro_custo');
      if (error) throw error;
      return (data || []).map(cc => ({
        value: cc.id,
        label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
      }));
    },
  });

  const solicitantesQuery = useQuery({
    queryKey: ['gestao-aprovacoes-solicitantes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('criado_por, profiles:criado_por(id, nome_completo)')
        .in('status_fluxo', STATUS_FLUXO_ATIVOS)
        .not('criado_por', 'is', null);
      if (error) throw error;

      const unique = new Map<string, string>();
      (data || []).forEach((item: any) => {
        if (item.profiles?.id && item.profiles?.nome_completo) {
          unique.set(item.profiles.id, item.profiles.nome_completo);
        }
      });

      return Array.from(unique.entries()).map(([id, nome]) => ({
        value: id,
        label: nome,
      })).sort((a, b) => a.label.localeCompare(b.label));
    },
  });

  return {
    solicitacoes: queryResult.data || [],
    kpis: kpisQuery.data || { aguardando_gerenteadm: 0, aguardando_diretor_operacional: 0, aguardando_diretor_adm: 0, finalizadas: 0 },
    isLoading: queryResult.isLoading || roleLoading || isLoadingPerms,
    isError: queryResult.isError,
    refetch: () => {
      queryResult.refetch();
      kpisQuery.refetch();
    },
    userFluxoRole,
    centrosCustoOptions: centrosCustoQuery.data || [],
    solicitantesOptions: solicitantesQuery.data || [],
  };
}
