
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
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log("🔐 User not authenticated, clearing permissions");
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        console.log('🔐 Loading dynamic permissions for user:', user.id);

        // Buscar perfil do usuário
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, nome_completo, funcoes')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Error fetching user profile:', profileError);
          throw profileError;
        }

        if (!profile?.funcoes || !Array.isArray(profile.funcoes) || profile.funcoes.length === 0) {
          console.warn('⚠️ User has no roles assigned in funcoes field');
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        console.log('📋 Funções do usuário encontradas:', profile.funcoes);

        // Filtrar funções válidas
        const validRoles = profile.funcoes.filter(role => 
          role && 
          role.trim() !== '' && 
          role !== 'user'
        );

        if (validRoles.length === 0) {
          console.warn('⚠️ User has no valid roles assigned');
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        const mainRole = validRoles[0];
        const isSuperAdmin = validRoles.includes('SuperAdm');

        console.log('👤 Função principal:', mainRole);
        console.log('👑 É SuperAdmin:', isSuperAdmin);

        // SISTEMA DINÂMICO CORRIGIDO: Buscar permissões das funções configuradas na tabela
        let userPermissions: string[] = [];

        if (isSuperAdmin) {
          // SuperAdmin tem todas as permissões disponíveis
          const { data: allPermissions, error: allPermError } = await supabase
            .from('bd_permissoes')
            .select('nome_permissao');
          
          if (allPermError) {
            console.error('❌ Error fetching all permissions for SuperAdmin:', allPermError);
          } else {
            userPermissions = allPermissions?.map(p => p.nome_permissao) || [];
            console.log('👑 SuperAdmin - todas as permissões carregadas:', userPermissions.length);
          }
        } else {
          // CORREÇÃO PRINCIPAL: Para outras funções, buscar permissões específicas com queries separadas
          console.log('🔍 Buscando configuração de permissões para funções:', validRoles);
          
          const { data: funcoesConfig, error: funcoesError } = await supabase
            .from('bd_funcoes_permissao')
            .select('nome_funcao, permissoes')
            .in('nome_funcao', validRoles);

          if (funcoesError) {
            console.error('❌ Error fetching role permissions:', funcoesError);
          } else {
            console.log('📊 Configurações de função encontradas:', funcoesConfig);
            
            if (funcoesConfig && funcoesConfig.length > 0) {
              // Coletar todos os IDs de permissões das funções do usuário
              const permissionIds: string[] = [];
              funcoesConfig.forEach(funcao => {
                console.log(`🔧 Processando função: ${funcao.nome_funcao}`, funcao.permissoes);
                if (funcao.permissoes && Array.isArray(funcao.permissoes)) {
                  permissionIds.push(...funcao.permissoes);
                }
              });

              console.log('🆔 IDs de permissões coletados:', permissionIds);

              if (permissionIds.length > 0) {
                // CORREÇÃO: Query separada para buscar nomes das permissões pelos IDs
                const { data: permissionNames, error: permissionNamesError } = await supabase
                  .from('bd_permissoes')
                  .select('nome_permissao')
                  .in('id', permissionIds);

                if (permissionNamesError) {
                  console.error('❌ Error fetching permission names:', permissionNamesError);
                } else {
                  userPermissions = permissionNames?.map(p => p.nome_permissao) || [];
                  console.log('✅ Nomes de permissões mapeados:', userPermissions);
                }
              } else {
                console.log('⚠️ Nenhum ID de permissão encontrado para as funções do usuário');
              }
            } else {
              console.log('⚠️ Nenhuma configuração de função encontrada na tabela bd_funcoes_permissao');
            }
          }
        }

        // Remover duplicatas
        userPermissions = [...new Set(userPermissions)];

        console.log('✅ CORREÇÃO APLICADA - Permissões finais carregadas:', {
          userId: user.id,
          roles: validRoles,
          mainRole,
          isSuperAdmin,
          permissionsCount: userPermissions.length,
          permissions: userPermissions
        });

        setPermissions({
          userId: user.id,
          isSuperAdmin,
          userRole: mainRole,
          permissions: userPermissions,
          isLoading: false,
        });

      } catch (error) {
        console.error('❌ Error loading user permissions:', error);
        toast({
          title: 'Erro de Permissões',
          description: 'Não foi possível carregar suas permissões.',
          variant: 'destructive',
        });
        
        setPermissions({
          userId: null,
          isSuperAdmin: false,
          userRole: null,
          permissions: [],
          isLoading: false,
        });
      }
    };

    loadUserPermissions();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserPermissions();
    });

    // Cache key para permitir invalidação externa
    queryClient.setQueryData(['auth-permissions'], () => loadUserPermissions);

    return () => subscription.unsubscribe();
  }, [toast, queryClient]);

  // Listener para invalidação de cache
  useEffect(() => {
    const handlePermissionUpdate = () => {
      console.log('🔄 Permissões atualizadas - recarregando...');
      const loadUserPermissions = async () => {
        // Re-executar a lógica de carregamento
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Trigger reload
          window.location.reload();
        }
      };
      loadUserPermissions();
    };

    // Escutar eventos personalizados de atualização de permissões
    window.addEventListener('permissions-updated', handlePermissionUpdate);
    
    return () => {
      window.removeEventListener('permissions-updated', handlePermissionUpdate);
    };
  }, []);

  return permissions;
};

// Hook para verificar permissão específica
export const useHasPermission = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useAuthPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return permissions.includes(requiredPermission);
};

// Hook para verificar múltiplas permissões
export const useHasAnyPermission = (requiredPermissions: string[]): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useAuthPermissions();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return requiredPermissions.some(permission => permissions.includes(permission));
};
