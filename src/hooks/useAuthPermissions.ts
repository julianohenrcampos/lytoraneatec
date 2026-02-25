
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface UserPermissions {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
  userEmail: string | null;
}

export const useAuthPermissions = (): UserPermissions => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: [],
    isLoading: true,
    userEmail: null,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        console.log('🔐 INÍCIO - Carregando permissões do usuário...');
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log("🔐 Usuário não autenticado");
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
            userEmail: null,
          });
          return;
        }

        console.log('🔐 Usuário autenticado:', user.email);

        // Emails SuperAdmin automáticos
        const SUPER_ADMIN_EMAILS = ['julianohcampos@yahoo.com.br', 'ramonvalentevalente@gmail.com'];

        // 🔧 FALLBACK GARANTIDO PARA FUNÇÕES SSO
        const SSO_ROLE_PERMISSIONS: Record<string, string[]> = {
          'TecSSO': ['acesso_sso_checklists', 'acesso_sso_desvios', 'acesso_sso_ver_agir', 'dashboard_view'],
          'AdmSSO': [
            'acesso_sso_checklists', 'acesso_sso_desvios', 'acesso_sso_dashboard',
            'acesso_sso_agendamento_exames', 'acesso_sso_ver_agir', 'dashboard_view', 'dashboard_rh_view',
            'gestao_rh_empresas_view', 'gestao_rh_departamentos_view',
            'gestao_rh_funcionarios_view', 'gestao_rh_funcoes_view',
            'gestao_rh_centros_custo_view', 'gestao_rh_equipes_view',
            // Permissões de Diárias (sem aprovação)
            'diarias_view', 'diarias_dashboard_view', 'diarias_solicitacoes_view',
            'diarias_apontamento_view', 'diarias_relatorio_view',
            'diarias_solicitar', 'diarias_solicitar_create',
            'diarias_solicitar_edit_own', 'diarias_solicitar_cancel_own',
            'diarias_solicitar_resend_own', 'diarias_export', 'diarias_exportar_excel'
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

        // Query usando o sistema profiles com funcoes[] como fonte primária
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select(`
            id, 
            email,
            nome_completo, 
            funcoes,
            funcao_sistema
          `)
          .eq('id', user.id)
          .single();

        if (profileErr) {
          console.warn('⚠️ Erro ao buscar perfil (RLS corrigida):', profileErr);
          // Fallback robusto para usuários autenticados
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: 'user',
            permissions: ['dashboard_view'],
            isLoading: false,
            userEmail: user.email || null,
          });
          return;
        }

        console.log('📋 Perfil encontrado com sucesso:', profile);

        // SISTEMA DE PERMISSÕES BASEADO NO NOVO SISTEMA UNIFICADO - funcoes[] como fonte primária
        let userRole: string | null = null;
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view']; // Permissão básica sempre

        // 1. Verificar por email (fallback principal)
        if (profile?.email && SUPER_ADMIN_EMAILS.includes(profile.email)) {
          isSuperAdmin = true;
          userRole = 'SuperAdm';
          console.log('🚀 SUPERADMIN detectado por EMAIL:', profile.email);
        }
        // 2. Verificar no array funcoes (fonte primária)
        else if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.includes('SuperAdm')) {
          isSuperAdmin = true;
          userRole = profile.funcoes[0]; // Primeira função como role principal
          console.log('🚀 SUPERADMIN detectado por FUNCOES:', profile.funcoes);
        }
        // 3. Usar funcoes[] para definir role (FONTE PRIMÁRIA)
        else if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0) {
          userRole = profile.funcoes[0];
          console.log('📋 Role definido por funcoes[]:', userRole);
        }
        // 4. Fallback para funcao_sistema (compatibilidade legada)
        else if (profile?.funcao_sistema) {
          userRole = profile.funcao_sistema;
          isSuperAdmin = profile.funcao_sistema === 'SuperAdm';
          console.log('⚠️ Usando funcao_sistema (fallback legado):', profile.funcao_sistema);
        }
          
        console.log('🔍 Função encontrada:', userRole);
        
        if (isSuperAdmin) {
          console.log('🚀 SUPERADMIN CONFIRMADO - LIBERANDO TODOS OS ACESSOS!');
          
          // SuperAdmin = TODAS as permissões do sistema
          userPermissions = [
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
            'registro_aplicacao_view',
            'programacao_entrega_view',
            'admin_permissoes_view',
            // Permissões Diárias (novas)
            'diarias_view',
            'diarias_dashboard_view',
            'diarias_solicitacoes_view',
            'diarias_apontamento_view',
            'diarias_relatorio_view',
            'diarias_solicitar_create',
            'diarias_solicitar_edit_own',
            'diarias_solicitar_cancel_own',
            'diarias_solicitar_resend_own',
            'diarias_aprovar',
            'diarias_autorizar',
            'diarias_apontar_own',
            'diarias_export',
            'diarias_solicitar',
            'diarias_exportar_excel'
          ];
        } else if (userRole) {
          // Buscar permissões da função no banco de dados
          console.log('🔍 Buscando permissões da função no banco:', userRole);
          
          const { data: funcaoPermissao, error: funcaoError } = await supabase
            .from('bd_funcoes_permissao')
            .select('permissoes')
            .eq('nome_funcao', userRole)
            .single();

          if (funcaoError || !funcaoPermissao?.permissoes) {
            console.warn('⚠️ Função não encontrada no banco, aplicando permissões básicas:', funcaoError?.message);
            userPermissions = ['dashboard_view'];
          } else {
            console.log('📋 Permissões IDs encontrados:', funcaoPermissao.permissoes);
            
            // Buscar nomes das permissões baseado nos IDs
            const { data: permissoesList, error: permissoesError } = await supabase
              .from('bd_permissoes')
              .select('nome_permissao')
              .in('id', funcaoPermissao.permissoes);

            if (permissoesError || !permissoesList) {
              console.warn('⚠️ Erro ao buscar nomes das permissões:', permissoesError?.message);
              userPermissions = ['dashboard_view'];
            } else {
              userPermissions = permissoesList.map(p => p.nome_permissao);
              console.log('✅ Permissões carregadas do banco:', userPermissions);
            }
          }
        } else {
          console.log('⚠️ Nenhuma função encontrada, aplicando usuário básico');
          userRole = 'user';
        }

        // 🔧 FALLBACK SSO: Garantir permissões mínimas para roles SSO
        if (profile?.funcoes?.includes('TecSSO') || profile?.funcoes?.includes('AdmSSO') || profile?.funcoes?.includes('GerenteRegional')) {
          const ssoRole = profile.funcoes.includes('AdmSSO') ? 'AdmSSO' : profile.funcoes.includes('GerenteRegional') ? 'GerenteRegional' : 'TecSSO';
          const minimumPermissions = SSO_ROLE_PERMISSIONS[ssoRole];
          
          console.log(`🔧 Aplicando fallback SSO para ${ssoRole}:`, minimumPermissions);
          
          // Mesclar permissões do banco com permissões mínimas garantidas
          userPermissions = [...new Set([...userPermissions, ...minimumPermissions])];
        }

        // Garantir que não há duplicatas
        userPermissions = [...new Set(userPermissions)];

        console.log('✅ RESULTADO FINAL DAS PERMISSÕES:', {
          userId: user.id,
          userRole,
          isSuperAdmin,
          permissionsCount: userPermissions.length,
          permissions: userPermissions
        });

        setPermissions({
          userId: user.id,
          isSuperAdmin,
          userRole,
          permissions: userPermissions,
          isLoading: false,
          userEmail: user.email || null,
        });

      } catch (error) {
        console.error('❌ Erro ao carregar permissões:', error);
        
        // Fallback de emergência para usuários autenticados
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        
        if (user) {
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: 'user',
            permissions: ['dashboard_view'],
            isLoading: false,
            userEmail: user.email || null,
          });
        } else {
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
            userEmail: null,
          });
        }
      }
    };

    loadUserPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      console.log('🔐 Auth state changed - reloading permissions');
      loadUserPermissions();
    });

    // Listener para mudanças na tabela profiles
    const profilesSubscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles' }, 
        async (payload) => {
          console.log('🔄 Profiles table changed, reloading permissions:', payload);
          const { data: { user } } = await supabase.auth.getUser();
          if (user && (payload.new.id === user.id || payload.old.id === user.id)) {
            loadUserPermissions();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      profilesSubscription.unsubscribe();
    };
  }, [toast, queryClient]);

  return permissions;
};

// Hook para verificar permissão específica - SIMPLIFICADO
export const useHasPermission = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, userRole, isLoading } = useAuthPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  // Verificação direta de permissão
  return permissions.includes(requiredPermission);
};

// Hook para verificar múltiplas permissões - SIMPLIFICADO
export const useHasAnyPermission = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useAuthPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return requiredPermissions.some(permission => permissions.includes(permission));
};
