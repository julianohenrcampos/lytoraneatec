// =====================================================
// HOOK: ESCOPO DE DADOS - DIÁRIAS
// Centraliza lógica de permissões e filtros por perfil
// =====================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import { hasRole as hasRoleNorm, hasAnyRole } from '@/utils/roleUtils';
import type { DiariaSolicitacao, SolicitacaoFilters, RelatorioFilters, RelatorioFolhaItem } from '@/types/diarias';

export type DiariasUserScope =
  | 'superadmin'
  | 'admsso'
  | 'admsede'
  | 'admobra'
  | 'delegado_rls'
  | 'engenheiro'
  | 'gerente'
  | 'apontador'
  | 'nenhum';

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
  backendCanCreateSolicitacao: boolean | null;
  
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
  canDeletePresenca: (item: RelatorioFolhaItem) => boolean;
}

export function useDiariasDataScope(): DiariasDataScope {
  const { userId, userRole, isSuperAdmin, permissions, isLoading: isLoadingPermissions, hasActionPermission } = usePermission();
  
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [centrosCustoGerenciados, setCentrosCustoGerenciadosRaw] = useState<string[]>([]);
  // Setter estável: só dispara re-render se o conteúdo do array realmente mudar.
  // Evita refetch em cascata no useRelatorioFolha quando os mesmos IDs são reatribuídos.
  const setCentrosCustoGerenciados = useCallback((next: string[]) => {
    setCentrosCustoGerenciadosRaw(prev => {
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, []);
  const [userScope, setUserScope] = useState<DiariasUserScope>('nenhum');
  const [isLoading, setIsLoading] = useState(true);
  const [backendCanCreateSolicitacao, setBackendCanCreateSolicitacao] = useState<boolean | null>(null);
  // Ajuste 4: AdmOBRA puro nunca retorna scopeFilters = {}.
  // Sempre devolve centro_custo_ids (mesmo que vazio) para evitar varredura sob RLS pesada.
  const [isAdmObraPuro, setIsAdmObraPuro] = useState(false);
  const [admObraScopeCcs, setAdmObraScopeCcs] = useState<string[] | null>(null);
  const admObraScopeFetchedAt = useRef<number>(0);
  const lastDeterminedUserId = useRef<string | null>(null);

  // Buscar dados do usuário e determinar escopo
  useEffect(() => {
    // Verificar dentro do effect (não nas deps) para evitar oscilação
    if (isLoadingPermissions || !userId) return;

    // Se já determinamos o escopo para este mesmo userId, não refazer
    if (lastDeterminedUserId.current === userId && userScope !== 'nenhum') return;

    const determineScope = async () => {
      setIsLoading(true);
      setBackendCanCreateSolicitacao(null);

      try {
        const { data: canCreateFromBackend, error: canCreateError } = await supabase.rpc('fn_diaria_can_create', {
          p_user_id: userId,
        });

        if (canCreateError) {
          console.error('[Diarias][Scope] erro ao consultar fn_diaria_can_create', {
            userId,
            message: canCreateError.message,
            code: canCreateError.code,
            details: canCreateError.details,
            hint: canCreateError.hint,
          });
          setBackendCanCreateSolicitacao(false);
        } else {
          setBackendCanCreateSolicitacao(Boolean(canCreateFromBackend));
        }

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

        const funcoesProfile = (profile?.funcoes as string[]) || [];

        // 2a. Buscar nomes de roles via bd_user_roles -> bd_roles(nome) e unir com profile.funcoes
        let roleNames: string[] = [];
        try {
          const { data: rolesData } = await supabase
            .from('bd_user_roles')
            .select('bd_roles(nome)')
            .eq('user_id', userId);
          roleNames = (rolesData || [])
            .map((r: any) => r?.bd_roles?.nome)
            .filter(Boolean);
        } catch (e) {
          // Falha silenciosa - usaremos só profile.funcoes
        }

        const rolesEfetivas = Array.from(new Set([...funcoesProfile, ...roleNames]));

        const hasRole = (name: string) => hasRoleNorm(rolesEfetivas, name);

        // Roles que indicam visibilidade administrativa/operacional ampla (não só criador)
        const rolesVisibilidadeAmpla = [
          'AdmOBRA',
          'GerenteRegional',
          'AdmSede',
          'AdmSSO',
          'Gerente',
          'Apontador',
          'Engenheiro Civil',
        ];
        const rolesAmplasPresentes = rolesVisibilidadeAmpla.filter(hasRole);

        // 2b. Verificar se é AdmSede (acesso por CC vinculado) - branch clássico mantido
        if (hasRole('AdmSede')) {
          setFuncionarioId(profile?.funcionario_id || null);

          // Buscar CCs gerenciados
          const { data: ccIds } = await supabase.rpc('get_admsede_centros_custo', {
            p_user_id: userId!,
          });

          if (ccIds && (ccIds as string[]).length > 0) {
            // Se também tem outras roles amplas (composto), delegar ao RLS
            const outrasRolesAmplas = rolesAmplasPresentes.filter(
              (r) => r !== 'AdmSede' && r !== 'Engenheiro Civil',
            );
            if (outrasRolesAmplas.length > 0) {
              setCentrosCustoGerenciados(ccIds as string[]);
              setUserScope('delegado_rls');
              lastDeterminedUserId.current = userId;
              setIsLoading(false);
              return;
            }

            setCentrosCustoGerenciados(ccIds as string[]);
            setUserScope('admsede');
            lastDeterminedUserId.current = userId;
            setIsLoading(false);
            return;
          }
        }

        // 2c. Verificar se é AdmSSO (visão ampla apenas quando houver acesso global real)
        if (hasRole('AdmSSO')) {
          setFuncionarioId(profile?.funcionario_id || null);
          setUserScope('admsso');
          lastDeterminedUserId.current = userId;
          setIsLoading(false);
          return;
        }

        const funcId = profile?.funcionario_id || null;
        setFuncionarioId(funcId);

        // 2d. AdmOBRA / GerenteRegional / perfis compostos => delegar ao RLS
        // O RLS (fn_diaria_can_select_row) já cobre criador OR responsável de campo OR CC autorizado
        if (hasRole('AdmOBRA') || hasRole('GerenteRegional') || rolesAmplasPresentes.length > 1) {
          // Ajuste 4 (Bloco 1): AdmOBRA "puro" — sem nenhuma role elevada — recebe
          // poda explícita por centro_custo_id no frontend, antes da RLS.
          // Cache de 5 min para fn_diaria_scope_centros_custo.
          const elevadas = ['SuperAdm', 'AdmRH', 'Financeiro', 'DP', 'DepartamentoPessoal'];
          const admObraPuro =
            hasRole('AdmOBRA') && !hasAnyRole(rolesEfetivas, elevadas);
          setIsAdmObraPuro(admObraPuro);

          if (admObraPuro) {
            const agora = Date.now();
            if (admObraScopeCcs === null || agora - admObraScopeFetchedAt.current > 5 * 60_000) {
              const STATUS_EXCLUIR = ['cancelado', 'cancelada', 'reprovada'];
              const funcIdAdmObra = profile?.funcionario_id || null;

              const [rpcRes, respRes, criadorRes, funcCcRes] = await Promise.allSettled([
                supabase.rpc('fn_diaria_scope_centros_custo', { p_user_id: userId }),
                funcIdAdmObra
                  ? supabase
                      .from('bd_diaria_solicitacoes')
                      .select('centro_custo_id')
                      .eq('responsavel_campo_id', funcIdAdmObra)
                      .not('centro_custo_id', 'is', null)
                      .not('status', 'in', `(${STATUS_EXCLUIR.join(',')})`)
                  : Promise.resolve({ data: [], error: null } as any),
                supabase
                  .from('bd_diaria_solicitacoes')
                  .select('centro_custo_id')
                  .eq('criado_por', userId)
                  .not('centro_custo_id', 'is', null)
                  .not('status', 'in', `(${STATUS_EXCLUIR.join(',')})`),
                // CC primário do AdmOBRA: vínculo direto do funcionário do profile
                // (paridade com useEscopoCentrosCusto do Agendamento de Exames).
                funcIdAdmObra
                  ? supabase
                      .from('bd_funcionarios')
                      .select('centro_custo_id')
                      .eq('id', funcIdAdmObra)
                      .maybeSingle()
                  : Promise.resolve({ data: null, error: null } as any),
              ]);

              const merged = new Set<string>();
              let teveSucesso = false;

              // RPC fn_diaria_scope_centros_custo
              if (rpcRes.status === 'fulfilled' && !(rpcRes.value as any).error) {
                teveSucesso = true;
                (((rpcRes.value as any).data as any[]) || []).forEach((r: any) => {
                  const id =
                    typeof r === 'string'
                      ? r
                      : r?.fn_diaria_scope_centros_custo ?? r?.id ?? null;
                  if (id) merged.add(id);
                });
              } else {
                console.warn(
                  '[Diarias][Scope] fn_diaria_scope_centros_custo falhou — seguindo com escopo parcial',
                  rpcRes,
                );
              }

              // Solicitações onde a Letícia é responsável de campo
              if (respRes.status === 'fulfilled' && !(respRes.value as any).error) {
                teveSucesso = true;
                (((respRes.value as any).data as any[]) || []).forEach((r: any) => {
                  if (r?.centro_custo_id) merged.add(r.centro_custo_id);
                });
              } else {
                console.warn(
                  '[Diarias][Scope] consulta responsavel_campo_id falhou — seguindo com escopo parcial',
                  respRes,
                );
              }

              // Solicitações criadas pelo usuário
              if (criadorRes.status === 'fulfilled' && !(criadorRes.value as any).error) {
                teveSucesso = true;
                (((criadorRes.value as any).data as any[]) || []).forEach((r: any) => {
                  if (r?.centro_custo_id) merged.add(r.centro_custo_id);
                });
              } else {
                console.warn(
                  '[Diarias][Scope] consulta criado_por falhou — seguindo com escopo parcial',
                  criadorRes,
                );
              }

              // CC primário do funcionário vinculado ao AdmOBRA
              if (funcCcRes.status === 'fulfilled' && !(funcCcRes.value as any).error) {
                const ccPrimario = ((funcCcRes.value as any).data as any)?.centro_custo_id;
                if (ccPrimario) {
                  teveSucesso = true;
                  merged.add(ccPrimario);
                }
              } else {
                console.warn(
                  '[Diarias][Scope] consulta bd_funcionarios.centro_custo_id falhou — seguindo com escopo parcial',
                  funcCcRes,
                );
              }

              // fail-closed: se TUDO falhou, lista vazia (RLS continua sendo barreira final)
              setAdmObraScopeCcs(teveSucesso ? Array.from(merged) : []);
              admObraScopeFetchedAt.current = agora;
            }
          }

          setUserScope('delegado_rls');
          lastDeterminedUserId.current = userId;
          setIsLoading(false);
          return;
        }

        if (!funcId) {
          // Sem vínculo com funcionário - apenas engenheiro (criador)
          setUserScope('engenheiro');
          lastDeterminedUserId.current = userId;
          setIsLoading(false);
          return;
        }

        // 3. Verificar se é Gerente Regional clássico (aprovador de algum CC)
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

        // 4. Verificar se é Apontador puro (responsável de campo em algum apontamento)
        // Perfis compostos que incluem apontamento já caíram em delegado_rls acima.
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
        // Fallback seguro: delegar ao RLS para não esconder dados indevidamente
        setUserScope('delegado_rls');
        lastDeterminedUserId.current = userId;
        setIsLoading(false);
      }
    };

    determineScope();
  }, [userId, isSuperAdmin]); // REMOVIDO isLoadingPermissions das deps

  // Filtros de escopo — RBAC PURO para o Relatório de Diárias.
  // Fonte ÚNICA: hasActionPermission('diarias_relatorio_view','visualizar') + acesso_global.
  // - SuperAdmin OU usuário com a ação 'visualizar' liberada → sem filtro frontend
  //   (o RLS é a barreira final por CC/criador/responsável).
  // - Caso contrário, mantemos o caminho legado por escopo (engenheiro vê só o que criou,
  //   gerente vê seus CCs, etc.) — preserva segurança para quem NÃO foi listado na permissão.
  const podeVerRelatorioCompleto = useMemo(
    () => isSuperAdmin || hasActionPermission('diarias_relatorio_view', 'visualizar'),
    [isSuperAdmin, hasActionPermission],
  );

  const scopeFilters = useMemo((): DiariasDataScopeFilters => {
    // Ajuste 4 (Bloco 1): AdmOBRA puro NUNCA retorna {}.
    // Sempre devolve centro_custo_ids — vazio se não tiver escopo (poda no frontend).
    if (isAdmObraPuro) {
      return { centro_custo_ids: admObraScopeCcs ?? [] };
    }

    // RBAC tem precedência absoluta — zero filtro frontend, RLS resolve.
    if (podeVerRelatorioCompleto) return {};

    // Fallback legado para perfis sem a permissão granular.
    if (userScope === 'admsede') return { centro_custo_ids: centrosCustoGerenciados };
    if (userScope === 'engenheiro') return { criado_por: userId || undefined };
    if (userScope === 'gerente') return { centro_custo_ids: centrosCustoGerenciados };
    if (userScope === 'apontador') return { responsavel_campo_id: funcionarioId || undefined };
    return {};
  }, [isAdmObraPuro, admObraScopeCcs, podeVerRelatorioCompleto, userScope, userId, centrosCustoGerenciados, funcionarioId]);

  // Funções de filtro para queries
  const getSolicitacoesFilter = useCallback((): SolicitacaoFilters & DiariasDataScopeFilters => {
    return { ...scopeFilters };
  }, [scopeFilters]);

  const getApontamentosFilter = useCallback((): { responsavel_campo_id?: string; centro_custo_ids?: string[] } => {
    if (userScope === 'apontador' && funcionarioId) {
      return { responsavel_campo_id: funcionarioId };
    }
    if ((userScope === 'gerente' || userScope === 'admsede') && centrosCustoGerenciados.length > 0) {
      return { centro_custo_ids: centrosCustoGerenciados };
    }
    // delegado_rls / admobra: sem filtro frontend, RLS resolve
    return {};
  }, [userScope, funcionarioId, centrosCustoGerenciados]);

  const getRelatorioFilter = useCallback((): RelatorioFilters & DiariasDataScopeFilters => {
    // Ajuste 4 (Bloco 1): AdmOBRA puro NUNCA retorna {}.
    if (isAdmObraPuro) {
      return { centro_custo_ids: admObraScopeCcs ?? [] };
    }
    // RBAC puro: quem tem 'diarias_relatorio_view:visualizar' (ou é SuperAdm) vê tudo.
    if (podeVerRelatorioCompleto) return {};
    // Fallback legado para usuários sem a permissão granular.
    if (userScope === 'admsede') return { centro_custo_ids: centrosCustoGerenciados };
    if (userScope === 'engenheiro') return { criado_por: userId || undefined };
    if (userScope === 'gerente') return { centro_custo_ids: centrosCustoGerenciados };
    return {};
  }, [isAdmObraPuro, admObraScopeCcs, podeVerRelatorioCompleto, userScope, userId, centrosCustoGerenciados]);

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
    if (backendCanCreateSolicitacao !== null) {
      return backendCanCreateSolicitacao;
    }

    if (isLoading || isLoadingPermissions || !userId) return false;

    if (isSuperAdmin) return true;

    const rolePodeCriar = [
      'AdmSSO',
      'AdmSede',
      'AdmOBRA',
      'GerenteRegional',
      'Gerente',
      'Engenheiro Civil',
    ].includes(userRole || '');

    if (rolePodeCriar) return true;

    if (userScope === 'apontador') return false;

    return (
      hasPermission('diarias_criar') ||
      hasPermission('diarias_solicitar_create') ||
      hasPermission('diarias_solicitar')
    );
  }, [backendCanCreateSolicitacao, hasPermission, isLoading, isLoadingPermissions, isSuperAdmin, userId, userRole, userScope]);

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

    if (userScope === 'admsso') return true;
    if ((userScope === 'admsede' || userScope === 'gerente') && centrosCustoGerenciados.includes(sol.centro_custo_id)) return true;

    // Criador pode excluir apenas rascunho/enviada
    if (sol.criado_por !== userId) return false;
    if (!['rascunho', 'enviada'].includes(sol.status)) return false;

    return hasPermission('diarias_solicitar_cancel_own') || hasPermission('diarias_solicitar');
  }, [userId, isSuperAdmin, hasPermission, userScope, centrosCustoGerenciados]);

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

    // Verificar se o CC pertence ao escopo do gerente/admsede
    if ((userScope === 'gerente' || userScope === 'admsede') && !centrosCustoGerenciados.includes(sol.centro_custo_id)) {
      return false;
    }

    // delegado_rls / admobra: o RLS já filtrou as solicitações visíveis;
    // a permissão RBAC controla se pode aprovar. Não aplicamos restrição extra de CC aqui
    // porque a lista de CCs autorizados não está enumerada no frontend para esses perfis.

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
    // delegado_rls / admobra: depende do RBAC; lista visível já passou pelo RLS
    if ((userScope === 'delegado_rls' || userScope === 'admobra') &&
        (hasPermission('diarias_aprovar') || hasPermission('diarias_autorizar'))) {
      return true;
    }
    return false;
  }, [isSuperAdmin, userScope, centrosCustoGerenciados, hasPermission]);

  const canApontar = useCallback((responsavelCampoId: string, criadoPor?: string | null) => {
    if (isSuperAdmin) return true;

    // Responsável em campo sempre pode apontar (regra de negócio: dono do CC)
    if (funcionarioId && responsavelCampoId === funcionarioId) return true;

    // Criador da solicitação também pode apontar (cobertura de urgência)
    if (criadoPor && userId === criadoPor) return true;

    // Decisão por RBAC granular: quem tem ação 'criar' ou 'editar' em
    // diarias_apontamento_view pode apontar (escopo de dados é resolvido pelo RLS).
    if (
      hasActionPermission('diarias_apontamento_view', 'criar') ||
      hasActionPermission('diarias_apontamento_view', 'editar')
    ) {
      return true;
    }

    // Compat: permissão histórica do Apontador
    if (responsavelCampoId === funcionarioId && hasPermission('diarias_apontar_own')) {
      return true;
    }

    return false;
  }, [isSuperAdmin, funcionarioId, userId, hasPermission, hasActionPermission]);

  const canDeletePresenca = useCallback((item: RelatorioFolhaItem): boolean => {
    // SuperAdmin pode excluir tudo
    if (isSuperAdmin) return true;
    // AdmSede pode excluir registros dos CCs gerenciados
    if (userScope === 'admsede' && centrosCustoGerenciados.includes(item.centro_custo_id)) return true;
    // AdmSSO pode excluir tudo (visão ampla)
    if (userScope === 'admsso') return true;
    // Engenheiro/Gerente/delegado_rls pode excluir se é solicitante
    if ((userScope === 'engenheiro' || userScope === 'gerente' || userScope === 'delegado_rls' || userScope === 'admobra')
        && item.solicitante_id === userId) return true;
    // Gerente pode excluir registros dos seus CCs
    if (userScope === 'gerente' && centrosCustoGerenciados.includes(item.centro_custo_id)) return true;
    return false;
  }, [isSuperAdmin, userScope, centrosCustoGerenciados, userId]);

  return {
    userScope,
    userId,
    funcionarioId,
    centrosCustoGerenciados,
    isLoading,
    backendCanCreateSolicitacao,
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
    canDeletePresenca,
  };
}
