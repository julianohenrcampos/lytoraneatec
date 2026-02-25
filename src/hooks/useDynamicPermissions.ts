import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { updateUserOfflineContext } from '@/utils/offlinePermissions';

interface DynamicPermissions {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
  canAccessDashboard: boolean;
}

// FALLBACK GARANTIDO: Lista de SuperAdmins por email
const SUPER_ADMIN_EMAILS = [
  'julianohcampos@yahoo.com.br',
  'ramonvalentevalente@gmail.com'
];

// 🔧 FALLBACK GARANTIDO PARA FUNÇÕES SSO - Garante acesso mesmo em falhas de rede/cache
const SSO_ROLE_PERMISSIONS: Record<string, string[]> = {
  'TecSSO': ['acesso_sso_checklists', 'acesso_sso_desvios', 'dashboard_view'],
  'AdmSSO': [
    'acesso_sso_checklists', 'acesso_sso_desvios', 'acesso_sso_dashboard',
    'acesso_sso_agendamento_exames', 'dashboard_view', 'dashboard_rh_view',
    'gestao_rh_empresas_view', 'gestao_rh_departamentos_view',
    'gestao_rh_funcionarios_view', 'gestao_rh_funcoes_view',
    'gestao_rh_centros_custo_view', 'gestao_rh_equipes_view',
    'diarias_view', 'diarias_solicitacoes_view',
    'diarias_apontamento_view', 'diarias_relatorio_view',
    'diarias_dashboard_view'
  ],
  'GerenteRegional': [
    'dashboard_view', 'dashboard_rh_view',
    'gestao_rh_funcionarios_view', 'gestao_rh_centros_custo_view',
    'gestao_rh_departamentos_view', 'gestao_rh_funcoes_view',
    'diarias_view', 'diarias_solicitacoes_view',
    'diarias_autorizar', 'diarias_aprovar',
    'diarias_apontamento_view', 'diarias_relatorio_view',
    'diarias_dashboard_view'
  ]
};

// Cache local otimizado com TTL maior para evitar revalidações frequentes
let permissionsCache: DynamicPermissions | null = null;
let lastCacheTime = 0;
let lastUserId: string | null = null; // Para detectar mudança de usuário
const CACHE_DURATION = 300000; // 5 minutos para evitar perda de formulários durante preenchimento

export const useDynamicPermissions = (): DynamicPermissions => {
  const [permissions, setPermissions] = useState<DynamicPermissions>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: ['dashboard_view'], // SEMPRE incluir dashboard básico
    isLoading: true,
    canAccessDashboard: true, // SEMPRE true como fallback
  });

  const loadDynamicPermissions = async () => {
    try {
      console.log('🔐 [DYNAMIC] Carregando permissões otimizadas...');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('⚠️ [DYNAMIC] Usuário não autenticado');
        setPermissions({
          userId: null,
          isSuperAdmin: false,
          userRole: null,
          permissions: [],
          isLoading: false,
          canAccessDashboard: false,
        });
        return;
      }

      console.log('👤 [DYNAMIC] Usuário autenticado:', user.email);

      // PRIORIDADE 1: Buscar perfil no banco SEMPRE primeiro
      console.log('🔍 [DYNAMIC] Buscando perfil do usuário...');
      
      const profilePromise = supabase
        .from('profiles')
        .select(`
          id, 
          nome_completo, 
          funcoes
        `)
        .eq('id', user.id)
        .single();

      // Timeout aumentado para conexões lentas (mobile)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      try {
        const { data: profile, error } = await Promise.race([
          profilePromise,
          timeoutPromise
        ]) as any;

        if (error) {
          throw error;
        }

        console.log('📋 [DYNAMIC] Perfil carregado:', {
          id: profile.id,
          nome_completo: profile.nome_completo,
          funcoes: profile.funcoes,
          email: user.email
        });

        // VERIFICAÇÃO USANDO APENAS funcoes[]
        if (!profile?.funcoes || !Array.isArray(profile.funcoes) || profile.funcoes.length === 0) {
          console.log('⚠️ [DYNAMIC] Usuário sem funcoes[] - AGUARDANDO APROVAÇÃO');
          
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
            canAccessDashboard: false, // BLOQUEAR acesso até aprovação
          });
          
          permissionsCache = null; // Não fazer cache de usuários não aprovados
          return;
        }

        // Sistema de permissões baseado em funcoes[] + consulta às tabelas de permissão
        let userRole: string | null = 'user';
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view']; // Permissão básica sempre

        // Verificar se é SuperAdmin
        if (profile.funcoes.includes('SuperAdm')) {
          isSuperAdmin = true;
          userRole = 'SuperAdm';
          
          console.log('🚀 [DYNAMIC] SuperAdmin detectado via funcoes[]');
          console.log('🔍 [DYNAMIC] Função encontrada:', userRole);

          // SuperAdmin = TODAS as permissões
          const { data: todasPermissoes } = await supabase
            .from('bd_permissoes')
            .select('nome_permissao');

          userPermissions = todasPermissoes?.map(p => p.nome_permissao) || [
            'dashboard_view', 'dashboard_rh_view', 'dashboard_maquinas_view', 'dashboard_cbuq_view',
            'gestao_rh_empresas_view', 'gestao_rh_departamentos_view', 'gestao_rh_centros_custo_view',
            'gestao_rh_funcoes_view', 'gestao_rh_funcionarios_view', 'gestao_rh_equipes_view',
            'gestao_maquinas_caminhoes_view', 'gestao_maquinas_usinas_view', 'gestao_maquinas_relatorio_medicao_view',
            'requisicoes_cadastro_view', 'requisicoes_programacao_entrega_view', 'requisicoes_registro_cargas_view',
            'requisicoes_registro_aplicacao_view', 'requisicoes_apontamento_equipe_view', 'requisicoes_apontamento_caminhoes_view',
            'requisicoes_chamados_os_view', 'requisicoes_gestao_os_view', 'admin_permissoes_view', 'relatorio_aplicacao_view'
          ];
        } else {
          // Usuário com função específica - buscar permissões reais
          userRole = profile.funcoes[0] || 'user';
          console.log('✅ [DYNAMIC] Função detectada:', userRole);
          
          // Buscar permissões da função nas tabelas
          console.log('🔍 [DYNAMIC] Buscando permissões da função:', userRole);
          
          const { data: funcaoPermissao, error: funcaoError } = await supabase
            .from('bd_funcoes_permissao')
            .select('permissoes')
            .eq('nome_funcao', userRole)
            .single();

          if (funcaoError) {
            console.warn('⚠️ [DYNAMIC] Erro ao buscar função ou função não encontrada:', funcaoError);
            userPermissions = ['dashboard_view']; // Fallback básico
          } else if (funcaoPermissao?.permissoes && funcaoPermissao.permissoes.length > 0) {
            console.log('📋 [DYNAMIC] IDs das permissões encontrados:', funcaoPermissao.permissoes);
            
            // Buscar nomes das permissões
            const { data: permissoesList, error: permissoesError } = await supabase
              .from('bd_permissoes')
              .select('nome_permissao')
              .in('id', funcaoPermissao.permissoes);

            if (permissoesError) {
              console.warn('⚠️ [DYNAMIC] Erro ao buscar detalhes das permissões:', permissoesError);
              userPermissions = ['dashboard_view'];
            } else {
              userPermissions = permissoesList?.map(p => p.nome_permissao) || ['dashboard_view'];
              console.log('✅ [DYNAMIC] Permissões carregadas:', userPermissions);
            }
          } else {
            console.log('⚠️ [DYNAMIC] Função sem permissões definidas');
            userPermissions = ['dashboard_view'];
          }
        }

        // 🔧 FALLBACK SSO: Garantir permissões mínimas para roles SSO
        if (profile.funcoes.includes('TecSSO') || profile.funcoes.includes('AdmSSO') || profile.funcoes.includes('GerenteRegional')) {
          const ssoRole = profile.funcoes.includes('AdmSSO') ? 'AdmSSO' : profile.funcoes.includes('GerenteRegional') ? 'GerenteRegional' : 'TecSSO';
          const minimumPermissions = SSO_ROLE_PERMISSIONS[ssoRole];
          
          console.log(`🔧 [DYNAMIC] Aplicando fallback SSO para ${ssoRole}:`, minimumPermissions);
          
          // Mesclar permissões do banco com permissões mínimas garantidas
          userPermissions = [...new Set([...userPermissions, ...minimumPermissions])];
        }

        // Garantir permissões únicas
        userPermissions = [...new Set(userPermissions)];

        const finalPermissions = {
          userId: user.id,
          isSuperAdmin,
          userRole,
          permissions: userPermissions,
          isLoading: false,
          canAccessDashboard: true,
        };

        console.log('✅ [DYNAMIC] PERMISSÕES FINAIS CARREGADAS:', {
          userId: user.id,
          userEmail: user.email,
          userRole,
          isSuperAdmin,
          totalPermissions: userPermissions.length,
          permissions: userPermissions,
          canAccessDashboard: true
        });
        
        setPermissions(finalPermissions);
        permissionsCache = finalPermissions;
        lastCacheTime = Date.now();
        
        // Sincronizar contexto offline para PWA
        updateUserOfflineContext(
          user.id,
          user.email || null,
          isSuperAdmin,
          userPermissions,
          userRole
        );

      } catch (dbError) {
        console.warn('⚠️ [DYNAMIC] Erro no banco, tentando MANTER permissões anteriores:', dbError);
        
        // PRIORIDADE 1: Se já temos permissões válidas no cache, MANTER (não revogar)
        if (permissionsCache && permissionsCache.permissions.length > 0) {
          console.log('✅ [DYNAMIC] Usando cache válido como fallback - NÃO revogando permissões');
          setPermissions(permissionsCache);
          return; // NÃO resetar!
        }
        
        // PRIORIDADE 2: Fallback de emergência para SuperAdmin
        const isEmergencySuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email || '');
        
        if (isEmergencySuperAdmin) {
          console.log('🚨 [DYNAMIC] Fallback de emergência para SuperAdmin:', user.email);
          const emergencyPermissions = {
            userId: user.id,
            isSuperAdmin: true,
            userRole: 'SuperAdm',
            permissions: [
              'dashboard_view', 'dashboard_rh_view', 'dashboard_maquinas_view', 'dashboard_cbuq_view',
              'gestao_rh_empresas_view', 'gestao_rh_departamentos_view', 'gestao_rh_centros_custo_view',
              'gestao_rh_funcoes_view', 'gestao_rh_funcionarios_view', 'gestao_rh_equipes_view',
              'gestao_maquinas_caminhoes_view', 'gestao_maquinas_usinas_view', 'gestao_maquinas_relatorio_medicao_view',
              'requisicoes_cadastro_view', 'requisicoes_programacao_entrega_view', 'requisicoes_registro_cargas_view',
              'requisicoes_registro_aplicacao_view', 'requisicoes_apontamento_equipe_view', 'requisicoes_apontamento_caminhoes_view',
              'requisicoes_chamados_os_view', 'requisicoes_gestao_os_view', 'admin_permissoes_view', 'relatorio_aplicacao_view'
            ],
            isLoading: false,
            canAccessDashboard: true,
          };
          setPermissions(emergencyPermissions);
          permissionsCache = emergencyPermissions;
          lastCacheTime = Date.now();
          return;
        }
        
        // PRIORIDADE 3: Tentar buscar apenas funcoes[] para fallback SSO
        try {
          const { data: profileFallback } = await supabase
            .from('profiles')
            .select('funcoes')
            .eq('id', user.id)
            .single();
          
          if (profileFallback?.funcoes?.includes('TecSSO')) {
            console.log('✅ [DYNAMIC] Fallback TecSSO ativado - mantendo acesso');
            const tecSSOFallback = {
              userId: user.id,
              isSuperAdmin: false,
              userRole: 'TecSSO',
              permissions: ['acesso_sso_checklists', 'acesso_sso_desvios', 'dashboard_view'],
              isLoading: false,
              canAccessDashboard: true,
            };
            setPermissions(tecSSOFallback);
            permissionsCache = tecSSOFallback;
            lastCacheTime = Date.now();
            return;
          }
          
          if (profileFallback?.funcoes?.includes('AdmSSO')) {
            console.log('✅ [DYNAMIC] Fallback AdmSSO ativado - mantendo acesso');
            const admSSOFallback = {
              userId: user.id,
              isSuperAdmin: false,
              userRole: 'AdmSSO',
              permissions: SSO_ROLE_PERMISSIONS['AdmSSO'],
              isLoading: false,
              canAccessDashboard: true,
            };
            setPermissions(admSSOFallback);
            permissionsCache = admSSOFallback;
            lastCacheTime = Date.now();
            return;
          }
        } catch (profileError) {
          console.warn('⚠️ [DYNAMIC] Não foi possível buscar perfil para fallback:', profileError);
        }
        
        // ÚLTIMO RECURSO: Bloquear apenas se não houver nenhum cache
        console.log('🚨 [DYNAMIC] Banco fora do ar e sem cache - bloqueando usuário');
        setPermissions({
          userId: user.id,
          isSuperAdmin: false,
          userRole: null,
          permissions: [],
          isLoading: false,
          canAccessDashboard: false,
        });
        lastCacheTime = Date.now();
      }

    } catch (error) {
      console.error('❌ [DYNAMIC] Erro crítico:', error);
      
      // FALLBACK FINAL: Estado de emergência
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      
      if (user) {
        setPermissions({
          userId: user.id,
          isSuperAdmin: SUPER_ADMIN_EMAILS.includes(user.email || ''),
          userRole: SUPER_ADMIN_EMAILS.includes(user.email || '') ? 'SuperAdm' : 'user',
          permissions: ['dashboard_view'],
          isLoading: false,
          canAccessDashboard: true,
        });
      } else {
        setPermissions({
          userId: null,
          isSuperAdmin: false,
          userRole: null,
          permissions: [],
          isLoading: false,
          canAccessDashboard: false,
        });
      }
    }
  };

  useEffect(() => {
    // Cache otimizado
    const now = Date.now();
    if (permissionsCache && (now - lastCacheTime) < CACHE_DURATION) {
      console.log('📦 [DYNAMIC] Cache válido - usando permissões armazenadas');
      setPermissions(permissionsCache);
      return;
    }

    loadDynamicPermissions();

    // Listener otimizado para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 [DYNAMIC] Auth state changed:', event);
      
      // Detectar mudança de usuário (logout/login de outro usuário)
      const newUserId = session?.user?.id || null;
      if (newUserId !== lastUserId) {
        console.log('🔄 [DYNAMIC] Usuário mudou, limpando cache:', { old: lastUserId, new: newUserId });
        permissionsCache = null;
        lastCacheTime = 0;
        lastUserId = newUserId;
      }
      
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Limpar cache em mudanças significativas
        permissionsCache = null;
        lastCacheTime = 0;
        loadDynamicPermissions();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return permissions;
};

// Hook otimizado para verificar permissão específica
export const useHasPermissionDynamic = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useDynamicPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return permissions.includes(requiredPermission);
};

// Hook otimizado para múltiplas permissões
export const useHasAnyPermissionDynamic = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useDynamicPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return requiredPermissions.some(permission => permissions.includes(permission));
};