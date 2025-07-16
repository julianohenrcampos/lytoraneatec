
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

        // Query usando o novo sistema unificado
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select(`
            id, 
            nome_completo, 
            funcao_permissao,
            bd_funcoes_permissao:funcao_permissao (
              id,
              nome_funcao,
              descricao,
              permissoes
            )
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

        // SISTEMA DE PERMISSÕES BASEADO NO NOVO SISTEMA UNIFICADO
        let userRole: string | null = null;
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view']; // Permissão básica sempre

        if (profile?.bd_funcoes_permissao) {
          const funcaoPermissao = profile.bd_funcoes_permissao as any;
          userRole = funcaoPermissao.nome_funcao;
          isSuperAdmin = funcaoPermissao.nome_funcao === 'SuperAdm';
          
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
              'admin_permissoes_view'
            ];
          } else {
            // Buscar permissões específicas da função
            if (funcaoPermissao.permissoes && funcaoPermissao.permissoes.length > 0) {
              try {
                const { data: permissoesList, error: permissoesError } = await supabase
                  .from('bd_permissoes')
                  .select('*')
                  .in('id', funcaoPermissao.permissoes);

                if (permissoesError) {
                  console.error('❌ Erro ao buscar permissões:', permissoesError);
                } else {
                  userPermissions = [
                    'dashboard_view',
                    ...permissoesList.map(p => p.nome_permissao)
                  ];
                }
              } catch (error) {
                console.error('❌ Erro na consulta de permissões:', error);
              }
            } else {
              console.log('⚠️ Função sem permissões específicas atribuídas');
            }
          }
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
