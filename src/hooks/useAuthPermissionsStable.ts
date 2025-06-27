
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserPermissions {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
}

const CACHE_KEY = 'auth_permissions_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useAuthPermissionsStable = (): UserPermissions => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: [],
    isLoading: true,
  });
  
  const loadingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Evitar múltiplas execuções
    if (loadingRef.current) return;
    loadingRef.current = true;

    const loadPermissions = async () => {
      try {
        // Verificar cache primeiro
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            console.log('🔑 Using cached permissions');
            setPermissions({ ...data, isLoading: false });
            loadingRef.current = false;
            return;
          }
        }

        // Timeout de segurança
        timeoutRef.current = setTimeout(() => {
          console.warn('⏰ Auth timeout - usando fallback');
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: 'user',
            permissions: ['dashboard_view'],
            isLoading: false,
          });
          loadingRef.current = false;
        }, 3000);

        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          clearTimeout(timeoutRef.current);
          setPermissions({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          loadingRef.current = false;
          return;
        }

        // Query única otimizada
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, nome_completo, funcoes')
          .eq('id', user.id)
          .single();

        if (!profile?.funcoes || !Array.isArray(profile.funcoes)) {
          clearTimeout(timeoutRef.current);
          const fallbackData = {
            userId: user.id,
            isSuperAdmin: false,
            userRole: 'user',
            permissions: ['dashboard_view'],
            isLoading: false,
          };
          setPermissions(fallbackData);
          loadingRef.current = false;
          return;
        }

        const validRoles = profile.funcoes.filter(role => 
          role && role.trim() !== '' && role !== 'user'
        );

        const mainRole = validRoles[0] || 'user';
        const isSuperAdmin = validRoles.includes('SuperAdm');

        let userPermissions: string[] = [];

        if (isSuperAdmin) {
          userPermissions = [
            'dashboard_view',
            'registro_aplicacao_view',
            'gestao_maquinas_relatorio_medicao_view',
            'acesso_dashboard_rh',
            'programacao_entrega_view'
          ];
        } else {
          // Permissões baseadas em roles
          const rolePermissions: Record<string, string[]> = {
            'AdmRH': ['dashboard_view', 'acesso_dashboard_rh'],
            'AdmEquipamentos': ['dashboard_view', 'gestao_maquinas_relatorio_medicao_view'],
            'AdmRequisicoes': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view'],
            'AdmLogistica': ['dashboard_view', 'registro_aplicacao_view', 'gestao_maquinas_relatorio_medicao_view'],
            'Apontador': ['dashboard_view', 'registro_aplicacao_view'],
            'Encarregado': ['dashboard_view', 'registro_aplicacao_view', 'gestao_maquinas_relatorio_medicao_view'],
            'Engenheiro Civil': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view'],
          };

          validRoles.forEach(role => {
            if (rolePermissions[role]) {
              userPermissions.push(...rolePermissions[role]);
            }
          });

          userPermissions = [...new Set(userPermissions)];
          
          if (userPermissions.length === 0) {
            userPermissions = ['dashboard_view'];
          }
        }

        clearTimeout(timeoutRef.current);

        const finalData = {
          userId: user.id,
          isSuperAdmin,
          userRole: mainRole,
          permissions: userPermissions,
          isLoading: false,
        };

        // Cache os dados
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          data: finalData,
          timestamp: Date.now()
        }));

        setPermissions(finalData);
        loadingRef.current = false;

        console.log('✅ Auth permissions loaded successfully:', {
          role: mainRole,
          isSuperAdmin,
          permissionsCount: userPermissions.length
        });

      } catch (error) {
        console.error('❌ Error loading permissions:', error);
        clearTimeout(timeoutRef.current);
        
        const fallbackData = {
          userId: null,
          isSuperAdmin: false,
          userRole: 'user',
          permissions: ['dashboard_view'],
          isLoading: false,
        };
        
        setPermissions(fallbackData);
        loadingRef.current = false;
      }
    };

    loadPermissions();

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      loadingRef.current = false;
    };
  }, []);

  return permissions;
};

// Hook de verificação de permissões
export const useHasPermissionStable = (requiredPermission: string): boolean => {
  const { isSuperAdmin, permissions, isLoading } = useAuthPermissionsStable();
  
  if (isLoading) return false;
  if (isSuperAdmin) return true;
  
  return permissions.includes(requiredPermission);
};
