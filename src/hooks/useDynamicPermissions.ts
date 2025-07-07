import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

// Cache local otimizado com TTL maior
let permissionsCache: DynamicPermissions | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 60000; // 1 minuto para reduzir consultas

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

      // FALLBACK 1: Verificar SuperAdmin por email (MAIS RÁPIDO)
      const isSuperAdminByEmail = SUPER_ADMIN_EMAILS.includes(user.email || '');
      
      if (isSuperAdminByEmail) {
        console.log('🚀 [DYNAMIC] SuperAdmin detectado por EMAIL - ACESSO TOTAL!');
        
        const allPermissions = [
          'dashboard_view', 'dashboard_rh_view', 'dashboard_maquinas_view', 'dashboard_cbuq_view',
          'gestao_rh_empresas_view', 'gestao_rh_departamentos_view', 'gestao_rh_centros_custo_view',
          'gestao_rh_funcoes_view', 'gestao_rh_funcionarios_view', 'gestao_rh_equipes_view',
          'gestao_maquinas_caminhoes_view', 'gestao_maquinas_usinas_view', 'gestao_maquinas_relatorio_medicao_view',
          'requisicoes_cadastro_view', 'requisicoes_programacao_entrega_view', 'requisicoes_registro_cargas_view',
          'requisicoes_registro_aplicacao_view', 'requisicoes_apontamento_equipe_view', 'requisicoes_apontamento_caminhoes_view',
          'requisicoes_chamados_os_view', 'requisicoes_gestao_os_view', 'admin_permissoes_view', 'relatorio_aplicacao_view'
        ];
        
        const superAdminPermissions = {
          userId: user.id,
          isSuperAdmin: true,
          userRole: 'SuperAdm',
          permissions: allPermissions,
          isLoading: false,
          canAccessDashboard: true,
        };
        
        setPermissions(superAdminPermissions);
        permissionsCache = superAdminPermissions;
        lastCacheTime = Date.now();
        return;
      }

      // FALLBACK 2: Buscar perfil com timeout otimizado
      console.log('🔍 [DYNAMIC] Buscando perfil do usuário...');
      
      const profilePromise = supabase
        .from('profiles')
        .select('id, nome_completo, funcoes, funcao_permissao')
        .eq('id', user.id)
        .single();

      // Timeout menor para evitar travamentos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      try {
        const { data: profile, error } = await Promise.race([
          profilePromise,
          timeoutPromise
        ]) as any;

        if (error) {
          throw error;
        }

        console.log('📋 [DYNAMIC] Perfil carregado:', profile);

        // Sistema de permissões simplificado
        let userRole: string | null = 'user';
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view'];

        if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0) {
          // Verificar SuperAdmin pelo banco
          if (profile.funcoes.includes('SuperAdm')) {
            userRole = 'SuperAdm';
            isSuperAdmin = true;
            userPermissions = [
              'dashboard_view', 'dashboard_rh_view', 'dashboard_maquinas_view', 'dashboard_cbuq_view',
              'gestao_rh_empresas_view', 'gestao_rh_departamentos_view', 'gestao_rh_centros_custo_view',
              'gestao_rh_funcoes_view', 'gestao_rh_funcionarios_view', 'gestao_rh_equipes_view',
              'gestao_maquinas_caminhoes_view', 'gestao_maquinas_usinas_view', 'gestao_maquinas_relatorio_medicao_view',
              'requisicoes_cadastro_view', 'requisicoes_programacao_entrega_view', 'requisicoes_registro_cargas_view',
              'requisicoes_registro_aplicacao_view', 'requisicoes_apontamento_equipe_view', 'requisicoes_apontamento_caminhoes_view',
              'requisicoes_chamados_os_view', 'requisicoes_gestao_os_view', 'admin_permissoes_view', 'relatorio_aplicacao_view'
            ];
          } else {
            // Permissões baseadas na primeira função válida
            const validRoles = profile.funcoes.filter(role => 
              role && role.trim() !== '' && role !== 'user'
            );

            if (validRoles.length > 0) {
              userRole = validRoles[0];
              console.log('✅ [DYNAMIC] Função detectada:', userRole);

              // 🔒 SISTEMA RESTRITIVO DE PERMISSÕES POR FUNÇÃO
              console.log('🔐 [SECURE] Aplicando permissões específicas para:', userRole);
              
              // Limpar permissões básicas para aplicar apenas as específicas
              userPermissions = ['dashboard_view'];
              
              if (userRole.includes('Adm') || userRole.includes('Administrador')) {
                userPermissions.push(
                  'dashboard_rh_view', 
                  'gestao_rh_funcionarios_view', 
                  'gestao_rh_equipes_view',
                  'gestao_rh_empresas_view',
                  'gestao_rh_departamentos_view',
                  'gestao_rh_centros_custo_view',
                  'gestao_rh_funcoes_view'
                  // 🚫 REMOVIDO: relatorio_aplicacao_view - Apenas SuperAdm
                );
              } else if (userRole.includes('Mestre') || userRole.includes('Encarregado')) {
                userPermissions.push(
                  'dashboard_rh_view', 
                  'dashboard_maquinas_view', 
                  'gestao_rh_equipes_view',
                  'requisicoes_apontamento_equipe_view',
                  'requisicoes_apontamento_caminhoes_view'
                  // 🚫 REMOVIDO: relatorio_aplicacao_view - Apenas SuperAdm
                );
              } else if (userRole.includes('Apontador')) {
                // 🚫 APONTADOR: ACESSO RESTRITO - SEM RELATÓRIOS ESPECIAIS
                userPermissions.push(
                  'requisicoes_registro_aplicacao_view',
                  'requisicoes_apontamento_equipe_view', 
                  'requisicoes_apontamento_caminhoes_view'
                  // 🚫 REMOVIDO: relatorio_aplicacao_view - Apenas SuperAdm
                );
                console.log('🔒 [APONTADOR] Permissões restritas aplicadas:', userPermissions);
              } else {
                // Usuário básico - apenas dashboard
                console.log('👤 [USER] Usuário básico - apenas dashboard');
              }
            }
          }
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

        console.log('✅ [DYNAMIC] Permissões finais otimizadas:', finalPermissions);
        setPermissions(finalPermissions);
        permissionsCache = finalPermissions;
        lastCacheTime = Date.now();

      } catch (dbError) {
        console.warn('⚠️ [DYNAMIC] Erro no banco, usando fallback seguro:', dbError);
        
        // FALLBACK 3: Usuário autenticado com permissões básicas
        const fallbackPermissions = {
          userId: user.id,
          isSuperAdmin: false,
          userRole: 'user',
          permissions: ['dashboard_view'],
          isLoading: false,
          canAccessDashboard: true,
        };
        
        setPermissions(fallbackPermissions);
        permissionsCache = fallbackPermissions;
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('🔄 [DYNAMIC] Auth state changed:', event);
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        // Limpar cache apenas em mudanças significativas
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