// =====================================================
// HOOK: ESCOPO DE DADOS - DIÁRIAS
// Centraliza lógica de permissões e filtros por perfil
// =====================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';
import type { DiariaSolicitacao, SolicitacaoFilters, RelatorioFilters } from '@/types/diarias';

export type DiariasUserScope = 'superadmin' | 'engenheiro' | 'gerente' | 'apontador' | 'nenhum';

export interface DiariasDataScopeFilters {
  criado_por?: string;
  centro_custo_ids?: string[];
  responsavel_campo_id?: string;
}

export interface DiariasDataScope {
  // Identificação do escopo
  userScope: DiariasUserScope;
  userId: string | null;
  funcionarioId: string | null;
  centrosCustoGerenciados: string[];
  isLoading: boolean;
  
  // Filtros automáticos para queries
  scopeFilters: DiariasDataScopeFilters;
  getSolicitacoesFilter: () => SolicitacaoFilters & DiariasDataScopeFilters;
  getApontamentosFilter: () => { responsavel_campo_id?: string };
  getRelatorioFilter: () => RelatorioFilters & DiariasDataScopeFilters;
  
  // Verificações de ação
  canCreateSolicitacao: boolean;
  canEditSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canDeleteSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canResendSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canApproveSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canRejectSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canApontar: (responsavelCampoId: string) => boolean;
  
  // Verificação de segregação
  isOwnSolicitacao: (sol: DiariaSolicitacao) => boolean;
  isGerenciaCentroCusto: (centroCustoId: string) => boolean;
}

export function useDiariasDataScope(): DiariasDataScope {
  const { userId, isSuperAdmin, permissions, isLoading: isLoadingPermissions } = useDynamicPermissions();
  
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [centrosCustoGerenciados, setCentrosCustoGerenciados] = useState<string[]>([]);
  const [userScope, setUserScope] = useState<DiariasUserScope>('nenhum');
  const [isLoading, setIsLoading] = useState(true);

  // Buscar dados do usuário e determinar escopo
  useEffect(() => {
    const determineScope = async () => {
      if (isLoadingPermissions || !userId) {
        setIsLoading(isLoadingPermissions);
        return;
      }

      setIsLoading(true);

      try {
        // 1. SuperAdmin = acesso total
        if (isSuperAdmin) {
          setUserScope('superadmin');
          setIsLoading(false);
          return;
        }

        // 2. Buscar funcionario_id do perfil do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('funcionario_id')
          .eq('id', userId)
          .single();

        const funcId = profile?.funcionario_id || null;
        setFuncionarioId(funcId);

        if (!funcId) {
          // Sem vínculo com funcionário - apenas engenheiro (criador)
          setUserScope('engenheiro');
          setIsLoading(false);
          return;
        }

        // 3. Verificar se é Gerente Regional (aprovador de algum CC)
        const { data: ccsGerenciados } = await supabase
          .from('bd_centros_custo')
          .select('id')
          .eq('aprovador_diarias_id', funcId);

        if (ccsGerenciados && ccsGerenciados.length > 0) {
          setCentrosCustoGerenciados(ccsGerenciados.map(cc => cc.id));
          setUserScope('gerente');
          setIsLoading(false);
          return;
        }

        // 4. Verificar se é Apontador (responsável de campo em algum apontamento)
        const { data: apontamentos } = await supabase
          .from('bd_diaria_apontamentos')
          .select('id')
          .eq('responsavel_campo_id', funcId)
          .limit(1);

        if (apontamentos && apontamentos.length > 0) {
          setUserScope('apontador');
          setIsLoading(false);
          return;
        }

        // 5. Default = Engenheiro (quem cria solicitações)
        setUserScope('engenheiro');
        setIsLoading(false);

      } catch (error) {
        console.error('Erro ao determinar escopo de diárias:', error);
        setUserScope('engenheiro'); // Fallback seguro
        setIsLoading(false);
      }
    };

    determineScope();
  }, [userId, isSuperAdmin, isLoadingPermissions]);

  // Filtros de escopo baseado no perfil
  const scopeFilters = useMemo((): DiariasDataScopeFilters => {
    if (userScope === 'superadmin') return {};
    if (userScope === 'engenheiro') return { criado_por: userId || undefined };
    if (userScope === 'gerente') return { centro_custo_ids: centrosCustoGerenciados };
    if (userScope === 'apontador') return { responsavel_campo_id: funcionarioId || undefined };
    return {};
  }, [userScope, userId, centrosCustoGerenciados, funcionarioId]);

  // Funções de filtro para queries
  const getSolicitacoesFilter = useCallback((): SolicitacaoFilters & DiariasDataScopeFilters => {
    return { ...scopeFilters };
  }, [scopeFilters]);

  const getApontamentosFilter = useCallback((): { responsavel_campo_id?: string } => {
    if (userScope === 'apontador' && funcionarioId) {
      return { responsavel_campo_id: funcionarioId };
    }
    return {};
  }, [userScope, funcionarioId]);

  const getRelatorioFilter = useCallback((): RelatorioFilters & DiariasDataScopeFilters => {
    if (userScope === 'superadmin') return {};
    if (userScope === 'engenheiro') return { criado_por: userId || undefined };
    if (userScope === 'gerente') return { centro_custo_ids: centrosCustoGerenciados };
    return {};
  }, [userScope, userId, centrosCustoGerenciados]);

  // Verificações de ação
  const hasPermission = useCallback((perm: string) => {
    return isSuperAdmin || permissions.includes(perm);
  }, [isSuperAdmin, permissions]);

  const isOwnSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    return sol.criado_por === userId;
  }, [userId]);

  const isGerenciaCentroCusto = useCallback((centroCustoId: string) => {
    return centrosCustoGerenciados.includes(centroCustoId);
  }, [centrosCustoGerenciados]);

  const canCreateSolicitacao = useMemo(() => {
    return hasPermission('diarias_solicitar_create') || hasPermission('diarias_solicitar') || hasPermission('diarias_view');
  }, [hasPermission]);

  const canEditSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    if (isSuperAdmin) return true;
    
    // Apenas o criador pode editar
    if (sol.criado_por !== userId) return false;
    
    // Apenas em status editáveis
    if (!['rascunho', 'enviada'].includes(sol.status)) return false;
    
    return hasPermission('diarias_solicitar_edit_own') || hasPermission('diarias_solicitar');
  }, [userId, isSuperAdmin, hasPermission]);

  const canDeleteSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    if (isSuperAdmin) return true;
    
    // Apenas o criador pode excluir
    if (sol.criado_por !== userId) return false;
    
    // Apenas em status editáveis
    if (!['rascunho', 'enviada'].includes(sol.status)) return false;
    
    return hasPermission('diarias_solicitar_cancel_own') || hasPermission('diarias_solicitar');
  }, [userId, isSuperAdmin, hasPermission]);

  const canResendSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    if (isSuperAdmin) return true;
    
    // Apenas o criador pode reenviar
    if (sol.criado_por !== userId) return false;
    
    // Apenas em status reprovada ou cancelada
    if (!['reprovada'].includes(sol.status)) return false;
    
    return hasPermission('diarias_solicitar_resend_own') || hasPermission('diarias_solicitar');
  }, [userId, isSuperAdmin, hasPermission]);

  const canApproveSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    // SuperAdmin pode aprovar TUDO (inclusive próprias, para testes/emergências)
    if (isSuperAdmin) return true;
    
    // Verificar se tem permissão de aprovação
    if (!hasPermission('diarias_aprovar') && !hasPermission('diarias_autorizar')) return false;
    
    // Verificar segregação: criador não pode aprovar própria solicitação
    if (sol.criado_por === userId) return false;
    
    // Verificar se o CC pertence ao escopo do gerente
    if (userScope === 'gerente' && !centrosCustoGerenciados.includes(sol.centro_custo_id)) {
      return false;
    }
    
    return true;
  }, [isSuperAdmin, hasPermission, userId, userScope, centrosCustoGerenciados]);

  const canRejectSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    // Mesma lógica de aprovação
    return canApproveSolicitacao(sol);
  }, [canApproveSolicitacao]);

  const canApontar = useCallback((responsavelCampoId: string) => {
    if (isSuperAdmin) return true;
    
    // Apontador só pode apontar nos seus próprios
    if (userScope === 'apontador') {
      return responsavelCampoId === funcionarioId && hasPermission('diarias_apontar_own');
    }
    
    // Gerente pode ver mas não apontar (apenas auditoria)
    return false;
  }, [isSuperAdmin, userScope, funcionarioId, hasPermission]);

  return {
    userScope,
    userId,
    funcionarioId,
    centrosCustoGerenciados,
    isLoading,
    scopeFilters,
    getSolicitacoesFilter,
    getApontamentosFilter,
    getRelatorioFilter,
    canCreateSolicitacao,
    canEditSolicitacao,
    canDeleteSolicitacao,
    canResendSolicitacao,
    canApproveSolicitacao,
    canRejectSolicitacao,
    canApontar,
    isOwnSolicitacao,
    isGerenciaCentroCusto,
  };
}
