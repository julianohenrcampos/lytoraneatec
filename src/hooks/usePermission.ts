import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { updateUserOfflineContext, getValidatedOfflineContext } from '@/utils/offlinePermissions';
import { ROUTE_PERMISSIONS, hasRoutePermission } from '@/constants/routePermissions';

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
  permissionsError: boolean;   // falha ao carregar permissões (sem cache válido)
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
  permissionsError: false,
  roleActions: [],
  userOverrides: [],
};

// Timeout para queries críticas de RBAC
const PERMISSION_QUERY_TIMEOUT_MS = 7000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[usePermission] Timeout (${ms}ms) em: ${label}`));
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Module-level cache
let _cache: PermissionState | null = null;
let _cacheTime = 0;
let _cacheUserId: string | null = null;
const CACHE_DURATION = 60000; // 1 minuto

/**
 * FASE 1A — Invalida o cache de runtime de permissões deste módulo.
 * Usado após salvar alterações em "Gestão de Permissões → Funções e Permissões"
 * para que a próxima leitura busque do banco em vez de servir cache stale.
 *
 * - Zera _cache, _cacheTime, _cacheUserId
 * - Limpa snapshot offline (user_offline_context) para evitar fallback stale
 * - NÃO altera TTL nem lógica de SuperAdm
 *
 * Nome distinto de `usePermissionCacheInvalidation` (hook React) para evitar conflito.
 */
export function invalidateUsePermissionRuntimeCache() {
  _cache = null;
  _cacheTime = 0;
  _cacheUserId = null;
  try {
    localStorage.removeItem('user_offline_context');
  } catch {
    // ignore (SSR / storage indisponível)
  }
}

// Mapeamento de rotas para permissões — fonte única em src/constants/routePermissions.ts

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

    const startedAt = performance.now();
    let earlyIsSuperAdmin = false;
    let currentUser: { id: string; email: string | null } | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setState({ ...EMPTY_STATE, isLoading: false, canAccessDashboard: false });
        _cache = null;
        loadingRef.current = false;
        return;
      }

      currentUser = { id: user.id, email: user.email ?? null };

      // Check cache validity
      if (_cache && _cacheUserId === user.id && (Date.now() - _cacheTime < CACHE_DURATION)) {
        setState({ ..._cache, isLoading: false, permissionsError: false });
        loadingRef.current = false;
        return;
      }

      // ============================================================
      // ⚠️ BYPASS EMERGENCIAL — Camada A: JWT app_metadata (SEM REDE)
      // Lê apenas claims confiáveis emitidos pelo Auth (app_metadata).
      // NUNCA usa user_metadata (controlável pelo usuário).
      // Libera APENAS UI/rotas — backend continua protegido por RLS.
      // Temporário, até estabilização do Supabase + consolidação do RBAC.
      // ============================================================
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const appMeta: any = session?.user?.app_metadata ?? {};
        const funcoesClaim: unknown[] = Array.isArray(appMeta.funcoes) ? appMeta.funcoes : [];
        const isSuperAdmFromJWT =
          funcoesClaim.some((f) => String(f ?? '').trim().toLowerCase() === 'superadm') ||
          appMeta.acesso_global === true;

        if (isSuperAdmFromJWT) {
          console.log('🚀 [usePermission] Bypass emergencial via app_metadata (JWT). permissions=["*"]');
          const adminState: PermissionState = {
            userId: user.id,
            userEmail: user.email ?? null,
            isSuperAdmin: true,
            userRole: 'SuperAdm',
            permissions: ['*'],
            permissionRoutes: Object.keys(ROUTE_PERMISSIONS),
            isLoading: false,
            canAccessDashboard: true,
            permissionsError: false,
            roleActions: [],
            userOverrides: [],
          };
          setState(adminState);
          _cache = adminState;
          _cacheTime = Date.now();
          _cacheUserId = user.id;
          // JWT não conta como "validado pelo servidor RBAC", mas é fonte
          // confiável (claim do Auth). Marcado como validatedFromServer=true
          // para permitir reidratação rápida em sessões futuras.
          updateUserOfflineContext(user.id, user.email ?? null, true, ['*'], 'SuperAdm', true);
          loadingRef.current = false;
          return;
        }
      } catch (jwtErr: any) {
        console.warn('⚠️ [usePermission] Leitura de app_metadata falhou (continua):', jwtErr?.message ?? jwtErr);
      }

      // ============================================================
      // ⚠️ BYPASS EMERGENCIAL — Camada B: snapshot offline validado
      // Só ativa se snapshot foi salvo após validação bem-sucedida do
      // servidor (validatedFromServer=true), pertence a este user.id e
      // está dentro de 24h. Libera APENAS UI/rotas — backend continua
      // protegido por RLS para qualquer operação sensível.
      // ============================================================
      try {
        const snap = getValidatedOfflineContext(user.id);
        if (snap && (snap.isSuperAdmin || snap.permissions?.includes('*'))) {
          console.log('🚀 [usePermission] Bypass emergencial via snapshot offline validado.');
          const adminState: PermissionState = {
            userId: user.id,
            userEmail: user.email ?? null,
            isSuperAdmin: true,
            userRole: snap.userRole ?? 'SuperAdm',
            permissions: ['*'],
            permissionRoutes: Object.keys(ROUTE_PERMISSIONS),
            isLoading: false,
            canAccessDashboard: true,
            permissionsError: false,
            roleActions: [],
            userOverrides: [],
          };
          setState(adminState);
          _cache = adminState;
          _cacheTime = Date.now();
          _cacheUserId = user.id;
          // Continua com a Camada C em background para revalidar; se falhar,
          // mantemos o estado já liberado (não derruba UI).
        }
      } catch (snapErr: any) {
        console.warn('⚠️ [usePermission] Snapshot offline falhou (continua):', snapErr?.message ?? snapErr);
      }

      // ============================================================
      // BYPASS ADMINISTRATIVO ANTES DO RBAC (Camada C — via profiles)
      // Confirma o bypass com fonte de verdade no banco quando disponível.
      // Timeout reduzido (3s) para falhar rápido quando Supabase está
      // instável; falha aqui NÃO derruba estado já liberado pelas
      // Camadas A/B. Temporário até estabilização.
      // ============================================================
      try {
        const { data: profile, error: profileError } = await withTimeout(
          supabase
            .from('profiles')
            .select('id, funcoes, acesso_global')
            .eq('id', user.id)
            .maybeSingle(),
          3000,
          'profiles (admin bypass)'
        );

        if (!profileError && profile) {
          const funcoesRaw: any = (profile as any).funcoes;
          const funcoes: unknown[] = Array.isArray(funcoesRaw)
            ? funcoesRaw
            : typeof funcoesRaw === 'string'
              ? [funcoesRaw]
              : [];
          const isSuperAdmFuncao = funcoes.some(
            (f) => String(f ?? '').trim().toLowerCase() === 'superadm'
          );
          const acessoGlobal = (profile as any).acesso_global === true;
          const isAdminBypass = isSuperAdmFuncao || acessoGlobal;

          // Log temporário de diagnóstico (remover após estabilização)
          console.log('🔍 [usePermission] Admin bypass check:', {
            userId: user.id,
            funcoesType: Array.isArray(funcoesRaw) ? 'array' : typeof funcoesRaw,
            funcoes,
            isSuperAdmFuncao,
            acessoGlobal,
            isAdminBypass,
          });

          if (isAdminBypass) {
            console.log('✅ [usePermission] Bypass administrativo aplicado antes do RBAC. permissions=["*"]');
            const adminState: PermissionState = {
              userId: user.id,
              userEmail: user.email ?? null,
              isSuperAdmin: true,
              userRole: 'SuperAdm',
              permissions: ['*'],
              permissionRoutes: Object.keys(ROUTE_PERMISSIONS),
              isLoading: false,
              canAccessDashboard: true,
              permissionsError: false,
              roleActions: [],
              userOverrides: [],
            };
            setState(adminState);
            _cache = adminState;
            _cacheTime = Date.now();
            _cacheUserId = user.id;
            updateUserOfflineContext(user.id, user.email ?? null, true, ['*'], 'SuperAdm', true);
            loadingRef.current = false;
            return;
          }
        } else if (profileError) {
          console.warn('⚠️ [usePermission] Falha ao ler profile para bypass (segue RBAC):', profileError);
        }
      } catch (bypassErr: any) {
        console.warn('⚠️ [usePermission] Bypass admin (Camada C) falhou:', bypassErr?.message ?? bypassErr);
        // Se Camadas A/B já liberaram o usuário (cache contém isSuperAdmin),
        // não derruba o estado: encerra aqui mantendo o bypass emergencial.
        if (_cache && _cacheUserId === user.id && _cache.isSuperAdmin) {
          console.log('🛡️ [usePermission] Mantendo bypass emergencial (A/B) ativo apesar de falha do RBAC.');
          loadingRef.current = false;
          return;
        }
      }

      // 1. Detecção precoce de SuperAdm via profiles.funcoes (paralela, tolerante a falha)
      //    Esse sinal é usado APENAS no fallback degradado se o RBAC granular falhar.
      //    Não substitui a fonte oficial de RBAC quando ela responde com sucesso.
      const earlyProfilePromise = withTimeout(
        supabase.from('profiles').select('funcoes').eq('id', user.id).maybeSingle(),
        PERMISSION_QUERY_TIMEOUT_MS,
        'profiles.funcoes (early)'
      ).then(
        (res) => {
          const funcoes = (res as any)?.data?.funcoes;
          if (Array.isArray(funcoes)) {
            earlyIsSuperAdmin = funcoes.some(
              (f: unknown) => typeof f === 'string' && f.trim().toLowerCase() === 'superadm'
            );
          }
        },
        (err) => {
          console.warn('⚠️ [usePermission] Detecção precoce de SuperAdm falhou (não crítico):', err?.message ?? err);
        }
      );

      // 2. Fetch user roles from bd_user_roles → bd_roles (com timeout)
      const userRolesPromise = withTimeout(
        supabase
          .from('bd_user_roles')
          .select('role_id, bd_roles(id, nome)')
          .eq('user_id', user.id),
        PERMISSION_QUERY_TIMEOUT_MS,
        'bd_user_roles'
      );

      // Aguarda ambas em paralelo. earlyProfilePromise nunca rejeita (catch interno).
      const [, userRolesRes] = await Promise.all([earlyProfilePromise, userRolesPromise]);
      const { data: userRoles, error: rolesError } = userRolesRes as any;

      let roleName: string | null = null;
      let roleIds: string[] = [];
      let isSuperAdmin = false;

      if (!rolesError && userRoles && userRoles.length > 0) {
        for (const ur of userRoles) {
          const role = ur.bd_roles as any;
          if (role?.nome) {
            if (!roleName) roleName = role.nome;
            roleIds.push(role.id);
            if (typeof role.nome === 'string' && role.nome.trim().toLowerCase() === 'superadm') {
              isSuperAdmin = true;
            }
          }
        }
      }

      // Fallback: if no roles in new system, try legacy profiles.funcoes
      if (!roleName) {
        const { data: profile } = await withTimeout(
          supabase
            .from('profiles')
            .select('funcoes')
            .eq('id', user.id)
            .maybeSingle(),
          PERMISSION_QUERY_TIMEOUT_MS,
          'profiles.funcoes'
        );

        if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0) {
          roleName = profile.funcoes[0];
          isSuperAdmin = profile.funcoes.some(
            (f: unknown) => typeof f === 'string' && f.trim().toLowerCase() === 'superadm'
          );

          if (roleName) {
            const { data: roleData } = await withTimeout(
              supabase
                .from('bd_roles')
                .select('id')
                .or(`nome.eq.${roleName},nome.ilike.${roleName.trim()}`)
                .limit(1),
              PERMISSION_QUERY_TIMEOUT_MS,
              'bd_roles lookup'
            );
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
          permissionsError: false,
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
        const { data: allPerms } = await withTimeout(
          supabase.from('bd_permissions').select('codigo, rota'),
          PERMISSION_QUERY_TIMEOUT_MS,
          'bd_permissions (superadmin)'
        );

        if (allPerms) {
          permissionCodes = [...new Set(allPerms.map(p => p.codigo))];
          permissionRoutes = [...new Set(allPerms.filter(p => p.rota).map(p => p.rota!))];
        }
      } else if (roleIds.length > 0) {
        const { data: rpaData } = await withTimeout(
          supabase
            .from('bd_role_permission_actions')
            .select('acao, bd_permissions(codigo, rota)')
            .in('role_id', roleIds),
          PERMISSION_QUERY_TIMEOUT_MS,
          'bd_role_permission_actions'
        );

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
          const { data: rpData } = await withTimeout(
            supabase
              .from('bd_role_permissions')
              .select('bd_permissions(codigo, rota)')
              .in('role_id', roleIds),
            PERMISSION_QUERY_TIMEOUT_MS,
            'bd_role_permissions'
          );

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

        const { data: overrides } = await withTimeout(
          supabase
            .from('bd_user_permission_overrides')
            .select('acao, permitido, bd_permissions(codigo)')
            .eq('user_id', user.id),
          PERMISSION_QUERY_TIMEOUT_MS,
          'bd_user_permission_overrides'
        );

        if (overrides) {
          userOverrides = overrides.map((o: any) => ({
            permissionCode: o.bd_permissions?.codigo || '',
            acao: o.acao,
            permitido: o.permitido,
          })).filter(o => o.permissionCode);
        }
      }

      // Legacy fallback
      if (!isSuperAdmin && permissionCodes.length <= 1 && roleName) {
        const { data: legacyFunc } = await withTimeout(
          supabase
            .from('bd_funcoes_permissao')
            .select('permissoes')
            .eq('nome_funcao', roleName)
            .single(),
          PERMISSION_QUERY_TIMEOUT_MS,
          'bd_funcoes_permissao'
        );

        if (legacyFunc?.permissoes && legacyFunc.permissoes.length > 0) {
          const { data: legacyPerms } = await withTimeout(
            supabase
              .from('bd_permissoes')
              .select('nome_permissao, rota')
              .in('id', legacyFunc.permissoes),
            PERMISSION_QUERY_TIMEOUT_MS,
            'bd_permissoes (legacy)'
          );

          if (legacyPerms) {
            const extraCodes = legacyPerms.map(p => p.nome_permissao);
            const extraRoutes = legacyPerms.filter(p => p.rota).map(p => p.rota!);
            permissionCodes = [...new Set([...permissionCodes, ...extraCodes])];
            permissionRoutes = [...new Set([...permissionRoutes, ...extraRoutes])];

            // Telemetria fire-and-forget: registra que este usuário ainda depende
            // do fallback legado (bd_funcoes_permissao + bd_permissoes).
            // Throttled para 1 evento por sessão por usuário; falha silenciosa
            // para nunca impactar o fluxo de permissões.
            try {
              const sessionKey = `rbac_legacy_logged_${user.id}`;
              if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, '1');
                void supabase
                  .from('bd_permission_audit_logs')
                  .insert({
                    user_id: user.id,
                    origem: 'legado_fallback',
                    permitido: true,
                    rota: roleName ?? null,
                  })
                  .then(() => {}, () => {});
              }
            } catch {
              /* telemetria nunca quebra o app */
            }
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
        permissionsError: false,
        roleActions,
        userOverrides,
      };

      setState(result);
      _cache = result;
      _cacheTime = Date.now();
      _cacheUserId = user.id;

      updateUserOfflineContext(
        user.id,
        user.email || null,
        isSuperAdmin,
        permissionCodes,
        roleName
      );

    } catch (error: any) {
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.error('❌ [usePermission] Falha ao carregar permissões:', {
        message: error?.message ?? String(error),
        elapsedMs,
        earlyIsSuperAdmin,
        hasCache: !!_cache,
        cacheAgeMs: _cache ? Date.now() - _cacheTime : null,
      });

      // 1) Se há cache válido, mantém o cache (cobre todos os perfis).
      if (_cache && (Date.now() - _cacheTime < CACHE_DURATION) && _cache.permissions.length > 0) {
        console.warn('⚠️ [usePermission] Usando cache válido após falha.');
        setState({ ..._cache, isLoading: false, permissionsError: false });
      } else if (earlyIsSuperAdmin && currentUser) {
        // 2) Bypass seguro do SuperAdm: validado via profiles.funcoes (server-side, RLS-protected).
        //    Libera acesso total em modo degradado SEM cachear, para reidratar o RBAC depois.
        console.warn(
          '⚠️ [usePermission] Falha RBAC, mas SuperAdm validado via profiles. ' +
          'Liberando acesso total (modo degradado).'
        );
        setState({
          userId: currentUser.id,
          userEmail: currentUser.email,
          isSuperAdmin: true,
          userRole: 'SuperAdm',
          permissions: ['*'],
          permissionRoutes: Object.keys(ROUTE_PERMISSIONS),
          isLoading: false,
          canAccessDashboard: true,
          permissionsError: false,
          roleActions: [],
          userOverrides: [],
        });
        // Auto-retry único após 15s para reidratar RBAC granular.
        setTimeout(() => {
          if (!loadingRef.current) {
            console.info('🔁 [usePermission] Reidratando RBAC após modo degradado...');
            loadPermissions();
          }
        }, 15000);
      } else {
        // 3) Usuário comum sem cache válido: bloqueio seguro.
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        setState({
          ...EMPTY_STATE,
          userId: user?.id || null,
          userEmail: user?.email || null,
          isLoading: false,
          canAccessDashboard: false,
          permissionsError: true,
          permissions: [],
          permissionRoutes: [],
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
    if (state.permissions.includes('*')) return true; // modo degradado SuperAdm
    return state.permissions.includes(codigo);
  }, [state.isLoading, state.isSuperAdmin, state.permissions]);

  const hasActionPermission = useCallback((codigo: string, acao: Acao): boolean => {
    if (state.isLoading) return false;
    if (state.isSuperAdmin) return true;
    if (state.permissions.includes('*')) return true; // modo degradado SuperAdm

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
    return hasRoutePermission(route, state.permissions, state.isSuperAdmin);
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
    permissionsError: state.permissionsError,
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
  if (permissions.includes('*')) return true;
  return permissions.includes(requiredPermission);
};

export const useHasAnyPermission = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = usePermission();
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  if (permissions.includes('*')) return true;
  return requiredPermissions.some(p => permissions.includes(p));
};

// Re-export for backward compat
export default usePermission;
