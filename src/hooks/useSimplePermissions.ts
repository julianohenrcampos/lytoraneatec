/**
 * @deprecated Hook legado mantido apenas como histórico.
 * Não importar em código novo. A fonte oficial de RBAC é
 * `usePermission` (src/hooks/usePermission.ts) com `ActionGuard`
 * e checagem backend via `fn_has_action`.
 * Remoção planejada em fase 5B-2.9-C/E.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { isSuperAdminFallbackEmail } from '@/config/superAdminEmails';
import { hasRole, hasAnyRole } from '@/utils/roleUtils';

interface SimplePermissions {
  isSuperAdmin: boolean;
  userRole: string | null;
  canAccessDashboard: boolean;
  isLoading: boolean;
}

export const useSimplePermissions = (): SimplePermissions => {
  const { userId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<SimplePermissions>({
    isSuperAdmin: false,
    userRole: null,
    canAccessDashboard: false,
    isLoading: true,
  });

  useEffect(() => {
    const loadPermissions = async () => {
      console.log('🔐 [SimplePermissions] Iniciando carregamento...', { 
        authLoading, 
        isAuthenticated, 
        userId 
      });
      
      if (authLoading) {
        console.log('🔐 [SimplePermissions] Aguardando auth loading...');
        return;
      }
      
      if (!isAuthenticated || !userId) {
        console.log('🔐 [SimplePermissions] Usuário não autenticado - resetando permissões');
        setPermissions({
          isSuperAdmin: false,
          userRole: null,
          canAccessDashboard: false,
          isLoading: false,
        });
        return;
      }

      try {
        console.log('🔐 [SimplePermissions] Carregando permissões para usuário:', userId);
        
        // Query simplificada focando apenas nas funções
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, email, funcoes')
          .eq('id', userId)
          .single();

        if (error) {
          console.warn('⚠️ [SimplePermissions] Erro RLS:', error);
          
          // Fallback: tentar buscar pelo email do usuário autenticado
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            console.log('🔄 [SimplePermissions] Tentando fallback por email:', user.email);
            
            // Verificação especial para SuperAdm conhecido (fallback centralizado)
            if (isSuperAdminFallbackEmail(user.email)) {
              console.log('🚀 [SimplePermissions] SuperAdm detectado por fallback de e-mail');
              setPermissions({
                isSuperAdmin: true,
                userRole: 'SuperAdm',
                canAccessDashboard: true,
                isLoading: false,
              });
              return;
            }
          }
          
          // Fallback básico para usuários autenticados
          console.log('🔄 [SimplePermissions] Aplicando fallback básico');
          setPermissions({
            isSuperAdmin: false,
            userRole: 'user',
            canAccessDashboard: true,
            isLoading: false,
          });
          return;
        }

        const funcoes = profile?.funcoes || [];
        console.log('📋 [SimplePermissions] Funções encontradas:', funcoes);
        
        // Verificação múltipla de SuperAdm
        const isSuperAdmin = hasAnyRole(funcoes, ['SuperAdm', 'SuperAdmin', 'super_admin']) ||
                            isSuperAdminFallbackEmail(profile?.email);
        
        // Determinar função principal
        let userRole = 'user';
        if (isSuperAdmin) {
          userRole = 'SuperAdm';
        } else if (hasRole(funcoes, 'AdmRH')) {
          userRole = 'AdmRH';
        } else if (hasRole(funcoes, 'Administrador')) {
          userRole = 'Administrador';
        } else if (hasRole(funcoes, 'Apontador')) {
          userRole = 'Apontador';
        } else if (hasRole(funcoes, 'Encarregado')) {
          userRole = 'Encarregado';
        } else if (hasRole(funcoes, 'Engenheiro Civil')) {
          userRole = 'Engenheiro Civil';
        }

        console.log('✅ [SimplePermissions] Permissões processadas:', {
          userId,
          email: profile?.email,
          funcoes,
          isSuperAdmin,
          userRole,
          canAccessDashboard: true
        });

        setPermissions({
          isSuperAdmin,
          userRole,
          canAccessDashboard: true, // Todos usuários autenticados podem acessar
          isLoading: false,
        });

      } catch (error) {
        console.error('❌ [SimplePermissions] Erro crítico:', error);
        
        // Fallback de emergência - ainda permitir acesso básico
        setPermissions({
          isSuperAdmin: false,
          userRole: 'user',
          canAccessDashboard: true,
          isLoading: false,
        });
      }
    };

    loadPermissions();
  }, [userId, isAuthenticated, authLoading]);

  return permissions;
};
