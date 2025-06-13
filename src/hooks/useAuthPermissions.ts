
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        console.log('🔐 Loading permissions for user:', user.id);

        // Buscar perfil do usuário com função de permissão
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            nome_completo,
            funcao_permissao
          `)
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Error fetching user profile:', profileError);
          throw profileError;
        }

        if (!profile?.funcao_permissao) {
          console.warn('⚠️ User has no permission function assigned');
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        // Buscar a função de permissão separadamente
        const { data: funcaoPermissao, error: funcaoError } = await supabase
          .from('bd_funcoes_permissao')
          .select(`
            id,
            nome_funcao,
            descricao,
            permissoes
          `)
          .eq('id', profile.funcao_permissao)
          .single();

        if (funcaoError) {
          console.error('❌ Error fetching user role:', funcaoError);
          throw funcaoError;
        }

        if (!funcaoPermissao) {
          console.warn('⚠️ User role not found');
          setPermissions({
            userId: user.id,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        const userRole = funcaoPermissao.nome_funcao;
        const isSuperAdmin = userRole === 'SuperAdm';

        // Se temos permissões como array de IDs, buscar os nomes das permissões
        let userPermissions: string[] = [];
        if (funcaoPermissao.permissoes && funcaoPermissao.permissoes.length > 0) {
          const { data: permissoes, error: permissoesError } = await supabase
            .from('bd_permissoes')
            .select('nome_permissao')
            .in('id', funcaoPermissao.permissoes);

          if (permissoesError) {
            console.error('❌ Error fetching permissions:', permissoesError);
          } else {
            userPermissions = permissoes?.map(p => p.nome_permissao) || [];
          }
        }

        console.log('✅ User permissions loaded:', {
          role: userRole,
          isSuperAdmin,
          permissions: userPermissions.length
        });

        setPermissions({
          userId: user.id,
          isSuperAdmin,
          userRole,
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserPermissions();
    });

    return () => subscription.unsubscribe();
  }, [toast]);

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
