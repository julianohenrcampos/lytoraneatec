import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { updateUserOfflineContext } from '@/utils/offlinePermissions';

// ============================================================
// HOOK ÚNICO DE PERMISSÕES — RBAC GRANULAR POR AÇÃO
// Fonte: bd_user_roles → bd_roles → bd_role_permission_actions
// Override: bd_user_permission_overrides
// Cache: 1 minuto, invalidado em auth state change
// ============================================================

type Acao = 'visualizar' | 'criar' | 'editar' | 'excluir' | 'aprovar';

interface PermissionState {
  userId: string | null;
  userEmail: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];       // códigos de permissão (backward compat)
  permissionRoutes: string[];  // rotas permitidas
  isLoading: boolean;
  canAccessDashboard: boolean;
  // Granular action data (loaded from new tables)
  roleActions: { permissionCode: string; acao: string }[];
  userOverrides: { permissionCode: string; acao: string; permitido: boolean }[];
}

const EMPTY_STATE: PermissionState = {
  userId: null,
  userEmail: null,
  isSuperAdmin: false,
  userRole: null,
  permissions: [],
  permissionRoutes: [],
  isLoading: true,
  canAccessDashboard: true,
  roleActions: [],
  userOverrides: [],
};

// Module-level cache
let _cache: PermissionState | null = null;
let _cacheTime = 0;
let _cacheUserId: string | null = null;
const CACHE_DURATION = 60000; // 1 minuto

// Mapeamento de rotas para permissões
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/': ['dashboard_view'],
  '/dashboard-rh': ['dashboard_rh_view'],
  '/dashboard-maquinas': ['dashboard_maquinas_view'],
  '/dashboard-cbuq': ['dashboard_cbuq_view'],
  '/gestao-rh/empresas': ['gestao_rh_empresas_view'],
  '/gestao-rh/departamentos': ['gestao_rh_departamentos_view'],
  '/gestao-rh/centros-custo': ['gestao_rh_centros_custo_view'],
  '/gestao-rh/funcoes': ['gestao_rh_funcoes_view'],
  '/gestao-rh/funcionarios': ['gestao_rh_funcionarios_view'],
  '/gestao-rh/equipes': ['gestao_rh_equipes_view'],
  '/gestao-rh/desligamentos': ['gestao_rh_funcionarios_view'],
  '/gestao-rh/diretorias': ['gestao_rh_diretorias_view'],
  '/gestao-maquinas/caminhoes': ['gestao_maquinas_caminhoes_view'],
  '/gestao-maquinas/caminhoes-equipamentos': ['gestao_maquinas_caminhoes_view'],
  '/gestao-maquinas/usinas': ['gestao_maquinas_usinas_view'],
  '/gestao-maquinas/relatorio-medicao': ['gestao_maquinas_relatorio_medicao_view'],
  '/gestao-maquinas/dashboard': ['dashboard_maquinas_view'],
  '/registro-aplicacao': ['requisicoes_registro_aplicacao_view'],
  '/programacao-entrega': ['requisicoes_programacao_entrega_view'],
  '/requisicoes/cadastro': ['requisicoes_cadastro_view'],
  '/requisicoes/programacao-entrega': ['requisicoes_programacao_entrega_view'],
  '/requisicoes/registro-cargas': ['requisicoes_registro_cargas_view'],
  '/requisicoes/registro-aplicacao': ['requisicoes_registro_aplicacao_view'],
  '/requisicoes/apontamento-equipe': ['requisicoes_apontamento_equipe_view'],
  '/requisicoes/apontamento-caminhoes': ['requisicoes_apontamento_caminhoes_view'],
  '/requisicoes/chamados-os': ['requisicoes_chamados_os_view'],
  '/requisicoes/gestao-os': ['requisicoes_gestao_os_view'],
  '/requisicoes/diarias/dashboard': ['diarias_dashboard_view'],
  '/requisicoes/diarias/solicitacoes': ['diarias_solicitacoes_view', 'diarias_view'],
  '/requisicoes/diarias/apontamento-campo': ['diarias_apontamento_view'],
  '/requisicoes/diarias/relatorio': ['diarias_relatorio_view'],
  '/requisicoes/diarias': ['diarias_view'],
  '/gestao-aprovacoes-diarias': ['acesso_gestao_aprovacoes'],
  '/sso/checklists': ['acesso_sso_checklists'],
  '/sso/desvios': ['acesso_sso_desvios'],
  '/sso/checklists/dashboard': ['acesso_sso_dashboard'],
  '/sso/agendamento-exames': ['acesso_sso_agendamento_exames'],
  '/sso/ver-e-agir': ['acesso_sso_ver_agir'],
  '/licitacoes/monitoramento-pncp': ['acesso_monitoramento_pncp'],
  '/licitacoes/configuracoes-pncp': ['configuracoes_pncp_view'],
  '/licitacoes/relatorio': ['relatorio_licitacoes_view'],
  '/licitacoes/dashboard': ['dashboard_licitacoes_view'],
  '/admin/permissoes': ['admin_permissoes_view'],
  '/admin/gestao-fluxos': ['admin_gestao_fluxos_view'],
  '/relatorio-aplicacao-diaria': ['relatorio_aplicacao_view'],
};

export const usePermission = () => {
  const [state, setState] = useState<PermissionState>(
    _cache && (Date.now() - _cacheTime < CACHE_DURATION)
      ? { ..._cache, isLoading: false }
      : EMPTY_STATE
  );
  const loadingRef = useRef(false);

  const loadPermissions = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const empty = { ...EMPTY_STATE, isLoading: false, canAccessDashboard: false };
        setState(empty);
        _cache = null;
        loadingRef.current = false;
        return;
      }

      // Check cache validity
      if (_cache && _cacheUserId === user.id && (Date.now() - _cacheTime < CACHE_DURATION)) {
        setState({ ..._cache, isLoading: false });
        loadingRef.current = false;
        return;
      }

      // 1. Fetch user roles from bd_user_roles → bd_roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('bd_user_roles')
        .select('role_id, bd_roles(id, nome)')
        .eq('user_id', user.id);

      let roleName: string | null = null;
      let roleIds: string[] = [];
      let isSuperAdmin = false;

      if (!rolesError && userRoles && userRoles.length > 0) {
        for (const ur of userRoles) {
          const role = ur.bd_roles as any;
          if (role?.nome) {
            if (!roleName) roleName = role.nome;
            roleIds.push(role.id);
            if (role.nome === 'SuperAdm') isSuperAdmin = true;
          }
        }
      }

      // Fallback: if no roles in new system, try legacy profiles.funcoes
      if (!roleName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('funcoes')
          .eq('id', user.id)
          .single();

        if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0) {
          roleName = profile.funcoes[0];
          isSuperAdmin = profile.funcoes.includes('SuperAdm');

          // Try to find role ID for legacy function name
          if (roleName) {
            const { data: roleData } = await supabase
              .from('bd_roles')
              .select('id')
              .or(`nome.eq.${roleName},nome.ilike.${roleName.trim()}`)
              .limit(1);
            if (roleData && roleData.length > 0) {
              roleIds = [roleData[0].id];
            }
          }
        }
      }

      // If no role at all, user is not approved
      if (!roleName) {
        const noAccess: PermissionState = {
          userId: user.id,
          userEmail: user.email || null,
          isSuperAdmin: false,
          userRole: null,
          permissions: [],
          permissionRoutes: [],
          isLoading: false,
          canAccessDashboard: false,
          roleActions: [],
          userOverrides: [],
        };
        setState(noAccess);
        _cache = null;
        loadingRef.current = false;
        return;
      }

      let permissionCodes: string[] = ['dashboard_view'];
      let permissionRoutes: string[] = ['/'];
      let roleActions: { permissionCode: string; acao: string }[] = [];
      let userOverrides: { permissionCode: string; acao: string; permitido: boolean }[] = [];

      if (isSuperAdmin) {
        // SuperAdmin: fetch ALL permissions from bd_permissions
        const { data: allPerms } = await supabase
          .from('bd_permissions')
          .select('codigo, rota');

        if (allPerms) {
          permissionCodes = [...new Set(allPerms.map(p => p.codigo))];
          permissionRoutes = [...new Set(allPerms.filter(p => p.rota).map(p => p.rota!))];
        }
      } else if (roleIds.length > 0) {
        // 2. Fetch role_permission_actions (new granular system)
        const { data: rpaData } = await supabase
          .from('bd_role_permission_actions')
          .select('acao, bd_permissions(codigo, rota)')
          .in('role_id', roleIds);

        if (rpaData && rpaData.length > 0) {
          const codes = new Set<string>(['dashboard_view']);
          const routes = new Set<string>(['/']);
          const actions: { permissionCode: string; acao: string }[] = [];

          for (const rpa of rpaData) {
            const perm = rpa.bd_permissions as any;
            if (perm?.codigo) {
              codes.add(perm.codigo);
              actions.push({ permissionCode: perm.codigo, acao: rpa.acao });
            }
            if (perm?.rota) routes.add(perm.rota);
          }

          permissionCodes = [...codes];
          permissionRoutes = [...routes];
          roleActions = actions;
        } else {
          // Fallback: try bd_role_permissions (old system without actions)
          const { data: rpData } = await supabase
            .from('bd_role_permissions')
            .select('bd_permissions(codigo, rota)')
            .in('role_id', roleIds);

          if (rpData) {
            const codes = new Set<string>(['dashboard_view']);
            const routes = new Set<string>(['/']);
            for (const rp of rpData) {
              const perm = rp.bd_permissions as any;
              if (perm?.codigo) codes.add(perm.codigo);
              if (perm?.rota) routes.add(perm.rota);
            }
            permissionCodes = [...codes];
            permissionRoutes = [...routes];
          }
        }

        // 3. Fetch user overrides
        const { data: overrides } = await supabase
          .from('bd_user_permission_overrides')
          .select('acao, permitido, bd_permissions(codigo)')
          .eq('user_id', user.id);

        if (overrides) {
          userOverrides = overrides.map((o: any) => ({
            permissionCode: o.bd_permissions?.codigo || '',
            acao: o.acao,
            permitido: o.permitido,
          })).filter(o => o.permissionCode);
        }
      }

      // Also check legacy bd_funcoes_permissao as additional fallback
      if (!isSuperAdmin && permissionCodes.length <= 1 && roleName) {
        const { data: legacyFunc } = await supabase
          .from('bd_funcoes_permissao')
          .select('permissoes')
          .eq('nome_funcao', roleName)
          .single();

        if (legacyFunc?.permissoes && legacyFunc.permissoes.length > 0) {
          const { data: legacyPerms } = await supabase
            .from('bd_permissoes')
            .select('nome_permissao, rota')
            .in('id', legacyFunc.permissoes);

          if (legacyPerms) {
            const extraCodes = legacyPerms.map(p => p.nome_permissao);
            const extraRoutes = legacyPerms.filter(p => p.rota).map(p => p.rota!);
            permissionCodes = [...new Set([...permissionCodes, ...extraCodes])];
            permissionRoutes = [...new Set([...permissionRoutes, ...extraRoutes])];
          }
        }
      }

      const result: PermissionState = {
        userId: user.id,
        userEmail: user.email || null,
        isSuperAdmin,
        userRole: roleName,
        permissions: permissionCodes,
        permissionRoutes,
        isLoading: false,
        canAccessDashboard: true,
        roleActions,
        userOverrides,
      };

      setState(result);
      _cache = result;
      _cacheTime = Date.now();
      _cacheUserId = user.id;

      // Sync offline context
      updateUserOfflineContext(
        user.id,
        user.email || null,
        isSuperAdmin,
        permissionCodes,
        roleName
      );

    } catch (error) {
      console.error('❌ [usePermission] Error:', error);

      // If we have cache, keep it
      if (_cache && _cache.permissions.length > 0) {
        setState({ ..._cache, isLoading: false });
      } else {
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        setState({
          ...EMPTY_STATE,
          userId: user?.id || null,
          userEmail: user?.email || null,
          isLoading: false,
          canAccessDashboard: !!user,
          permissions: user ? ['dashboard_view'] : [],
        });
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Apenas reagir a eventos que realmente mudam a identidade do usuário.
      // INITIAL_SESSION e TOKEN_REFRESHED são disparados com frequência e
      // causariam invalidação de cache + piscar da UI.
      if (event === 'SIGNED_OUT') {
        _cache = null;
        _cacheUserId = null;
        setState({ ...EMPTY_STATE, isLoading: false, canAccessDashboard: false });
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        _cache = null; // Invalidate cache on real auth change
        loadPermissions();
      }
      // Ignorar INITIAL_SESSION, TOKEN_REFRESHED, PASSWORD_RECOVERY, etc.
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadPermissions]);

  // ---- PUBLIC API ----

  const hasPermission = useCallback((codigo: string): boolean => {
    if (state.isLoading) return false;
    if (state.isSuperAdmin) return true;
    return state.permissions.includes(codigo);
  }, [state.isLoading, state.isSuperAdmin, state.permissions]);

  const hasActionPermission = useCallback((codigo: string, acao: Acao): boolean => {
    if (state.isLoading) return false;
    if (state.isSuperAdmin) return true;

    // 1. Check user override first
    const override = state.userOverrides.find(
      o => o.permissionCode === codigo && o.acao === acao
    );
    if (override !== undefined) return override.permitido;

    // 2. Check role actions
    const hasAction = state.roleActions.some(
      ra => ra.permissionCode === codigo && ra.acao === acao
    );
    if (hasAction) return true;

    // 3. Fallback: if no granular data, check basic permission for 'visualizar'
    if (acao === 'visualizar' && state.roleActions.length === 0) {
      return state.permissions.includes(codigo);
    }

    return false;
  }, [state]);

  const hasRouteAccess = useCallback((route: string): boolean => {
    if (state.isLoading) return false;
    if (state.isSuperAdmin) return true;

    const required = ROUTE_PERMISSIONS[route];
    if (!required) return true; // Unrestricted route

    return required.some(perm => state.permissions.includes(perm));
  }, [state.isLoading, state.isSuperAdmin, state.permissions]);

  const getAccessibleRoutes = useCallback((): string[] => {
    if (state.isSuperAdmin) return Object.keys(ROUTE_PERMISSIONS);
    return Object.keys(ROUTE_PERMISSIONS).filter(route => hasRouteAccess(route));
  }, [state.isSuperAdmin, hasRouteAccess]);

  // Compat: checkRoutePermission alias
  const checkRoutePermission = hasRouteAccess;

  // Debug helper
  const debugRouteAccess = useCallback((route: string) => {
    console.group(`🔍 Route Access Debug: ${route}`);
    console.log('Loading:', state.isLoading);
    console.log('Is SuperAdmin:', state.isSuperAdmin);
    console.log('Role:', state.userRole);
    console.log('Required:', ROUTE_PERMISSIONS[route] || 'None');
    console.log('User Permissions:', state.permissions);
    console.log('Can Access:', hasRouteAccess(route));
    console.groupEnd();
  }, [state, hasRouteAccess]);

  // Clear cache utility
  const clearCache = useCallback(() => {
    _cache = null;
    _cacheTime = 0;
    _cacheUserId = null;
    loadPermissions();
  }, [loadPermissions]);

  return {
    // State
    userId: state.userId,
    userEmail: state.userEmail,
    isSuperAdmin: state.isSuperAdmin,
    userRole: state.userRole,
    permissions: state.permissions,
    permissionRoutes: state.permissionRoutes,
    isLoading: state.isLoading,
    canAccessDashboard: state.canAccessDashboard,
    roleActions: state.roleActions,
    userOverrides: state.userOverrides,

    // Methods
    hasPermission,
    hasActionPermission,
    hasRouteAccess,
    checkRoutePermission,
    getAccessibleRoutes,
    debugRouteAccess,
    clearCache,
  };
};

// Convenience hooks
export const useHasPermission = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = usePermission();
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  return permissions.includes(requiredPermission);
};

export const useHasAnyPermission = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = usePermission();
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  return requiredPermissions.some(p => permissions.includes(p));
};

// Re-export for backward compat
export default usePermission;
