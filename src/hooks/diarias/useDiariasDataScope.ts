// =====================================================
// HOOK: ESCOPO DE DADOS - DIÁRIAS
// Centraliza lógica de permissões e filtros por perfil
// =====================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';
import type { DiariaSolicitacao, SolicitacaoFilters, RelatorioFilters } from '@/types/diarias';

export type DiariasUserScope = 'superadmin' | 'admsso' | 'engenheiro' | 'gerente' | 'apontador' | 'nenhum';

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
  getApontamentosFilter: () => { responsavel_campo_id?: string; centro_custo_ids?: string[] };
  getRelatorioFilter: () => RelatorioFilters & DiariasDataScopeFilters;
  
  // Verificações de ação
  canCreateSolicitacao: boolean;
  canEditSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canDeleteSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canResendSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canApproveSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canRejectSolicitacao: (sol: DiariaSolicitacao) => boolean;
  canCancelAutorizacao: (sol: DiariaSolicitacao) => boolean;
  canApontar: (responsavelCampoId: string, criadoPor?: string | null) => boolean;
  
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
  const lastDeterminedUserId = useRef<string | null>(null);

  // Buscar dados do usuário e determinar escopo
  useEffect(() => {
    // Verificar dentro do effect (não nas deps) para evitar oscilação
    if (isLoadingPermissions || !userId) return;

    // Se já determinamos o escopo para este mesmo userId, não refazer
    if (lastDeterminedUserId.current === userId && userScope !== 'nenhum') return;

    const determineScope = async () => {
      setIsLoading(true);

      try {
        // 1. SuperAdmin = acesso total
        if (isSuperAdmin) {
          setUserScope('superadmin');
          lastDeterminedUserId.current = userId;
          setIsLoading(false);
          return;
        }

        // 2. Buscar funcionario_id e funcoes do perfil do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('funcionario_id, funcoes')
          .eq('id', userId)
          .single();

        // 2b. Verificar se é AdmSSO (visão ampla, sem aprovação)
        const funcoes = (profile?.funcoes as string[]) || [];
        if (funcoes.includes('AdmSSO') || funcoes.includes('AdmOBRA')) {
          setFuncionarioId(profile?.funcionario_id || null);
          setUserScope('admsso');
          lastDeterminedUserId.current = userId;
          setIsLoading(false);
          return;
        }

        const funcId = profile?.funcionario_id || null;
        setFuncionarioId(funcId);

        if (!funcId) {
          // Sem vínculo com funcionário - apenas engenheiro (criador)
          setUserScope('engenheiro');
          lastDeterminedUserId.current = userId;
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
          lastDeterminedUserId.current = userId;
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
          lastDeterminedUserId.current = userId;
          setIsLoading(false);
          return;
        }

        // 5. Default = Engenheiro (quem cria solicitações)
        setUserScope('engenheiro');
        lastDeterminedUserId.current = userId;
        setIsLoading(false);

      } catch (error) {
        console.error('Erro ao determinar escopo de diárias:', error);
        setUserScope('engenheiro'); // Fallback seguro
        lastDeterminedUserId.current = userId;
        setIsLoading(false);
      }
    };

    determineScope();
  }, [userId, isSuperAdmin]); // REMOVIDO isLoadingPermissions das deps

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

  const getApontamentosFilter = useCallback((): { responsavel_campo_id?: string; centro_custo_ids?: string[] } => {
    if (userScope === 'apontador' && funcionarioId) {
      return { responsavel_campo_id: funcionarioId };
    }
    if (userScope === 'gerente' && centrosCustoGerenciados.length > 0) {
      return { centro_custo_ids: centrosCustoGerenciados };
    }
    return {};
  }, [userScope, funcionarioId, centrosCustoGerenciados]);

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
    if (userScope === 'admsso') return true;
    if (userScope === 'apontador') return false;
    return hasPermission('diarias_solicitar_create') || hasPermission('diarias_solicitar') || hasPermission('diarias_view');
  }, [hasPermission, userScope]);

  const canEditSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    if (isSuperAdmin) return true;
    
    // Apenas o criador pode editar
    if (sol.criado_por !== userId) return false;
    
    // Apenas em status editáveis
    if (!['rascunho', 'enviada'].includes(sol.status)) return false;
    
    return hasPermission('diarias_solicitar_edit_own') || hasPermission('diarias_solicitar');
  }, [userId, isSuperAdmin, hasPermission]);

  const canDeleteSolicitacao = useCallback((sol: DiariaSolicitacao) => {
    // SuperAdmin pode excluir qualquer solicitação
    if (isSuperAdmin) return true;
    
    // AdmSSO pode excluir qualquer solicitação (cascata)
    if (permissions.includes('acesso_sso_checklists')) return true;
    
    // Criador pode excluir apenas rascunho/enviada
    if (sol.criado_por !== userId) return false;
    if (!['rascunho', 'enviada'].includes(sol.status)) return false;
    
    return hasPermission('diarias_solicitar_cancel_own') || hasPermission('diarias_solicitar');
  }, [userId, isSuperAdmin, hasPermission, permissions]);

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
    
    // AdmSSO NÃO pode aprovar
    if (userScope === 'admsso') return false;
    
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

  const canCancelAutorizacao = useCallback((sol: DiariaSolicitacao) => {
    if (sol.status !== 'autorizada') return false;
    if (isSuperAdmin) return true;
    if (userScope === 'gerente' && centrosCustoGerenciados.includes(sol.centro_custo_id)) return true;
    return false;
  }, [isSuperAdmin, userScope, centrosCustoGerenciados]);

  const canApontar = useCallback((responsavelCampoId: string, criadoPor?: string | null) => {
    if (isSuperAdmin) return true;
    
    // Responsável em campo pode apontar
    if (funcionarioId && responsavelCampoId === funcionarioId) return true;
    
    // Criador da solicitação também pode apontar (cobertura de urgência)
    if (criadoPor && userId === criadoPor) return true;
    
    // Apontador só pode apontar nos seus próprios
    if (userScope === 'apontador') {
      return responsavelCampoId === funcionarioId && hasPermission('diarias_apontar_own');
    }
    
    // AdmSSO e Gerente = somente leitura
    return false;
  }, [isSuperAdmin, userScope, funcionarioId, userId, hasPermission]);

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
    canCancelAutorizacao,
    canApontar,
    isOwnSolicitacao,
    isGerenciaCentroCusto,
  };
}
