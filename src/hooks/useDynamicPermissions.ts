
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

// Cache local para evitar consultas desnecessárias
let permissionsCache: DynamicPermissions | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 30000; // 30 segundos

export const useDynamicPermissions = (): DynamicPermissions => {
  const [permissions, setPermissions] = useState<DynamicPermissions>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: ['dashboard_view'], // SEMPRE incluir dashboard básico
    isLoading: true,
    canAccessDashboard: true, // SEMPRE true como fallback
  });
  const { toast } = useToast();

  const loadDynamicPermissions = async () => {
    try {
      console.log('🔐 [DYNAMIC] Carregando permissões dinâmicas...');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('🔐 [DYNAMIC] Usuário não autenticado');
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

      console.log('🔐 [DYNAMIC] Usuário autenticado:', user.email);

      // FALLBACK 1: Verificar se é SuperAdmin por email
      const isSuperAdminByEmail = SUPER_ADMIN_EMAILS.includes(user.email || '');
      
      if (isSuperAdminByEmail) {
        console.log('🚀 [DYNAMIC] SuperAdmin detectado por EMAIL - ACESSO TOTAL!');
        
        // Buscar TODAS as permissões do banco para SuperAdmin
        const { data: todasPermissoes } = await supabase
          .from('bd_permissoes')
          .select('nome_permissao');

        const allPermissions = todasPermissoes?.map(p => p.nome_permissao) || [
          'dashboard_view',
          'dashboard_rh_view',
          'dashboard_maquinas_view',
          'dashboard_cbuq_view',
          'gestao_rh_empresas_view',
          'gestao_rh_departamentos_view',
          'gestao_rh_centros_custo_view',
          'gestao_rh_funcoes_view',
          'gestao_rh_funcionarios_view',
          'gestao_rh_equipes_view',
          'acesso_dashboard_rh',
          'gestao_maquinas_caminhoes_view',
          'gestao_maquinas_usinas_view',
          'gestao_maquinas_relatorio_medicao_view',
          'requisicoes_cadastro_view',
          'requisicoes_programacao_entrega_view',
          'requisicoes_registro_cargas_view',
          'requisicoes_registro_aplicacao_view',
          'requisicoes_apontamento_equipe_view',
          'requisicoes_apontamento_caminhoes_view',
          'requisicoes_chamados_os_view',
          'requisicoes_gestao_os_view',
          'admin_permissoes_view'
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

      // FALLBACK 2: Buscar perfil do usuário com timeout
      console.log('🔍 [DYNAMIC] Buscando perfil do usuário...');
      
      const profilePromise = supabase
        .from('profiles')
        .select('id, nome_completo, funcoes, funcao_permissao')
        .eq('id', user.id)
        .single();

      // Timeout de 5 segundos para evitar travamentos
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

        console.log('📋 [DYNAMIC] Perfil carregado:', profile);

        // SISTEMA DINÂMICO: Buscar permissões baseadas na função do usuário
        let userRole: string | null = 'user';
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view'];

        if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0) {
          // Verificar se é SuperAdmin pelo banco
          if (profile.funcoes.includes('SuperAdm')) {
            userRole = 'SuperAdm';
            isSuperAdmin = true;
            
            // Buscar TODAS as permissões para SuperAdmin
            const { data: todasPermissoes } = await supabase
              .from('bd_permissoes')
              .select('nome_permissao');

            userPermissions = todasPermissoes?.map(p => p.nome_permissao) || [];
          } else {
            // BUSCA DINÂMICA: Para usuários normais, buscar permissões da função
            const validRoles = profile.funcoes.filter(role => 
              role && role.trim() !== '' && role !== 'user'
            );

            if (validRoles.length > 0) {
              userRole = validRoles[0];
              console.log('✅ [DYNAMIC] Função detectada:', userRole);

              // Buscar função na tabela bd_funcoes_permissao
              const { data: funcaoPermissao, error: funcaoError } = await supabase
                .from('bd_funcoes_permissao')
                .select('nome_funcao, permissoes')
                .eq('nome_funcao', userRole)
                .single();

              if (!funcaoError && funcaoPermissao?.permissoes) {
                console.log('🔍 [DYNAMIC] Permissões da função encontradas:', funcaoPermissao.permissoes);
                
                // Buscar nomes das permissões baseado nos IDs
                const { data: permissoesDetalhes, error: permissoesError } = await supabase
                  .from('bd_permissoes')
                  .select('nome_permissao')
                  .in('id', funcaoPermissao.permissoes);

                if (!permissoesError && permissoesDetalhes) {
                  userPermissions.push(...permissoesDetalhes.map(p => p.nome_permissao));
                  console.log('✅ [DYNAMIC] Permissões dinâmicas carregadas:', userPermissions);
                } else {
                  console.warn('⚠️ [DYNAMIC] Erro ao buscar detalhes das permissões:', permissoesError);
                }
              } else {
                console.warn('⚠️ [DYNAMIC] Função não encontrada no banco:', userRole);
                
                // FALLBACK: Permissões básicas para funções não cadastradas
                if (userRole.includes('Adm') || userRole.includes('Administrador')) {
                  userPermissions.push('acesso_dashboard_rh', 'gestao_rh_funcionarios_view');
                }
                if (userRole.includes('Mestre') || userRole.includes('Encarregado')) {
                  userPermissions.push('dashboard_rh_view', 'dashboard_maquinas_view', 'gestao_rh_equipes_view');
                }
                if (userRole.includes('Apontador')) {
                  userPermissions.push('requisicoes_registro_aplicacao_view', 'requisicoes_programacao_entrega_view', 'requisicoes_registro_cargas_view');
                }
              }
            }
          }
        }

        // Garantir que não há duplicatas e sempre incluir dashboard_view
        userPermissions = [...new Set(['dashboard_view', ...userPermissions])];

        const finalPermissions = {
          userId: user.id,
          isSuperAdmin,
          userRole,
          permissions: userPermissions,
          isLoading: false,
          canAccessDashboard: true,
        };

        console.log('✅ [DYNAMIC] Permissões finais dinâmicas:', finalPermissions);
        setPermissions(finalPermissions);
        permissionsCache = finalPermissions;
        lastCacheTime = Date.now();

      } catch (dbError) {
        console.warn('⚠️ [DYNAMIC] Erro no banco, usando fallback:', dbError);
        
        // FALLBACK 3: Usuário autenticado básico
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
    // Verificar cache primeiro
    const now = Date.now();
    if (permissionsCache && (now - lastCacheTime) < CACHE_DURATION) {
      console.log('📦 [DYNAMIC] Usando cache de permissões');
      setPermissions(permissionsCache);
      return;
    }

    loadDynamicPermissions();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('🔄 [DYNAMIC] Auth state changed:', event);
      // Limpar cache ao mudar auth
      permissionsCache = null;
      lastCacheTime = 0;
      loadDynamicPermissions();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return permissions;
};

// Hook para verificar permissão específica
export const useHasPermissionDynamic = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useDynamicPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return permissions.includes(requiredPermission);
};

// Hook para verificar múltiplas permissões
export const useHasAnyPermissionDynamic = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useDynamicPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return requiredPermissions.some(permission => permissions.includes(permission));
};
