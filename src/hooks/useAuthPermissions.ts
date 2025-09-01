
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
}

export const useAuthPermissions = (): UserPermissions => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: [],
    isLoading: true,
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
          });
          return;
        }

        console.log('🔐 Usuário autenticado:', user.email);

        // Emails SuperAdm automáticos
        const SUPER_ADM_EMAILS = ['julianohcampos@yahoo.com.br', 'ramonvalentevalente@gmail.com'];

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
          });
          return;
        }

        console.log('📋 Perfil encontrado com sucesso:', profile);

        // SISTEMA DE PERMISSÕES BASEADO NO NOVO SISTEMA UNIFICADO - funcoes[] como fonte primária
        let userRole: string | null = null;
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view']; // Permissão básica sempre

        // 1. Verificar por email (fallback principal)
        if (profile?.email && SUPER_ADM_EMAILS.includes(profile.email)) {
          isSuperAdmin = true;
          userRole = 'SuperAdm';
          console.log('🚀 SUPERADM detectado por EMAIL:', profile.email);
        }
        // 2. Verificar no array funcoes (fonte primária)
        else if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.includes('SuperAdm')) {
          isSuperAdmin = true;
          userRole = profile.funcoes[0]; // Primeira função como role principal
          console.log('🚀 SUPERADM detectado por FUNCOES:', profile.funcoes);
        }
        // 3. Fallback para funcao_sistema (compatibilidade)
        else if (profile?.funcao_sistema) {
          userRole = profile.funcao_sistema;
          isSuperAdmin = profile.funcao_sistema === 'SuperAdm';
          console.log('⚠️ Usando funcao_sistema (fallback):', profile.funcao_sistema);
        }
        // 4. Usar funcoes[] para definir role se não for SuperAdmin
        else if (profile?.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0) {
          userRole = profile.funcoes[0];
          console.log('📋 Role definido por funcoes[]:', userRole);
        }

        // 5. Verificar se é apontador de alguma equipe
        if (!isSuperAdmin && profile?.email) {
          console.log('🔍 Verificando se é apontador de equipe para:', profile.email);
          
          try {
            // Buscar funcionário pelo email
            const { data: funcionario } = await supabase
              .from('bd_funcionarios')
              .select('id')
              .eq('email', profile.email)
              .single();

            if (funcionario) {
              // Verificar se é apontador de alguma equipe
              const { data: equipeApontador } = await supabase
                .from('bd_equipes')
                .select('id, nome_equipe')
                .eq('apontador_id', funcionario.id)
                .maybeSingle();

              if (equipeApontador) {
                userRole = 'Apontador';
                console.log('📍 APONTADOR detectado - equipe:', equipeApontador.nome_equipe);
              }
            }
          } catch (error) {
            console.warn('⚠️ Erro ao verificar se é apontador:', error);
          }
        }
          
        console.log('🔍 Função encontrada:', userRole);
        
        if (isSuperAdmin) {
          console.log('🚀 SUPERADM CONFIRMADO - LIBERANDO TODOS OS ACESSOS!');
          
          // SuperAdm = TODAS as permissões do sistema
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
            'admin_permissoes_view'
          ];
        } else if (userRole === 'Apontador') {
          // Permissões específicas para apontadores
          console.log('📍 Aplicando permissões de APONTADOR');
          userPermissions = [
            'dashboard_view',
            'requisicoes_apontamento_equipe_view'
          ];
        } else if (userRole === 'AdmRH' || userRole === 'Administrador') {
          // Permissões para administradores RH
          console.log('👔 Aplicando permissões de ADM RH');
          userPermissions = [
            'dashboard_view',
            'dashboard_rh_view',
            'gestao_rh_funcionarios_view',
            'gestao_rh_equipes_view',
            'requisicoes_apontamento_equipe_view'
          ];
        } else if (userRole) {
          // Para outras funções, aplicar permissões básicas
          console.log('⚠️ Função não-SuperAdm, aplicando permissões básicas');
          userPermissions = ['dashboard_view'];
        } else {
          console.log('⚠️ Nenhuma função encontrada, aplicando usuário básico');
          userRole = 'user';
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
          });
        } else {
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
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
