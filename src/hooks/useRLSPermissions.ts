import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface RLSPermissionsState {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  allowedTeams: string[];
  isLoading: boolean;
  canAccessDashboard: boolean;
}

// Type for permission data from the database
interface PermissionData {
  nome_permissao: string;
  rota?: string;
}

interface FuncaoPermissaoData {
  permissoes: string[];
  bd_permissoes: PermissionData | PermissionData[] | null;
}

export const useRLSPermissions = (): RLSPermissionsState => {
  const { userId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<RLSPermissionsState>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: [],
    allowedTeams: [],
    isLoading: true,
    canAccessDashboard: false,
  });

  useEffect(() => {
    const loadRLSPermissions = async () => {
      console.log('🔐 [RLS] Carregando permissões RLS...', { authLoading, isAuthenticated, userId });
      
      if (authLoading) {
        console.log('🔐 [RLS] Aguardando auth loading...');
        return;
      }
      
      if (!isAuthenticated || !userId) {
        console.log('🔐 [RLS] Usuário não autenticado - resetando permissões');
        setState({
          userId: null,
          isSuperAdmin: false,
          userRole: null,
          permissions: [],
          allowedTeams: [],
          isLoading: false,
          canAccessDashboard: false,
        });
        return;
      }

      try {
        console.log('🔐 [RLS] Carregando dados do usuário autenticado:', userId);
        
        // Buscar dados do perfil com fallback robusto
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, email, funcoes')
          .eq('id', userId)
          .single();

        if (profileErr) {
          console.warn('⚠️ [RLS] Erro ao buscar perfil via RLS:', profileErr);
          
          // Fallback: verificar se é um email conhecido de SuperAdmin
          const { data: { user } } = await supabase.auth.getUser();
          const superAdminEmails = ['julianohcampos@yahoo.com.br', 'wallinsonvs@gmail.com'];
          
          if (user?.email && superAdminEmails.includes(user.email)) {
            console.log('🚀 [RLS] SUPERADMIN detectado por email fallback!');
            setState({
              userId,
              isSuperAdmin: true,
              userRole: 'SuperAdm',
              permissions: ['*'], // Todas as permissões
              allowedTeams: ['*'], // Todas as equipes
              isLoading: false,
              canAccessDashboard: true,
            });
            return;
          }
          
          // Fallback para usuário autenticado básico
          setState({
            userId,
            isSuperAdmin: false,
            userRole: 'user',
            permissions: ['dashboard_view'],
            allowedTeams: [],
            isLoading: false,
            canAccessDashboard: true,
          });
          return;
        }

        console.log('📋 [RLS] Perfil encontrado:', profile);

        // Determinar se é SuperAdmin
        const funcoes = profile?.funcoes || [];
        const isSuperAdmin = funcoes.includes('SuperAdm') || 
                            funcoes.includes('SuperAdmin') || 
                            profile?.email === 'julianohcampos@yahoo.com.br' ||
                            profile?.email === 'wallinsonvs@gmail.com';

        // Determinar papel principal
        let userRole = 'user';
        if (isSuperAdmin) {
          userRole = 'SuperAdm';
        } else if (funcoes.includes('AdmRH')) {
          userRole = 'AdmRH';
        } else if (funcoes.includes('Administrador')) {
          userRole = 'Administrador';
        } else if (funcoes.includes('Apontador')) {
          userRole = 'Apontador';
        } else if (funcoes.includes('Encarregado')) {
          userRole = 'Encarregado';
        } else if (funcoes.includes('Operador')) {
          userRole = 'Operador';
        }

        // Buscar permissões específicas se não for SuperAdmin
        let permissions: string[] = ['dashboard_view'];
        let allowedTeams: string[] = [];

        if (isSuperAdmin) {
          console.log('🚀 [RLS] SUPERADMIN confirmado - liberando todos os acessos!');
          permissions = ['*']; // Todas as permissões
          allowedTeams = ['*']; // Todas as equipes
        } else {
          // Buscar permissões específicas via RLS
          try {
            const { data: permissionsData } = await supabase
              .from('bd_funcoes_permissao')
              .select(`
                permissoes,
                bd_permissoes!inner(nome_permissao, rota)
              `)
              .contains('nome_funcao', funcoes);

            if (permissionsData && permissionsData.length > 0) {
              const userPermissions = new Set<string>();
              
              (permissionsData as FuncaoPermissaoData[]).forEach(fp => {
                if (fp.bd_permissoes) {
                  // Handle bd_permissoes as either array or single object
                  let permissoesList: PermissionData[];
                  
                  if (Array.isArray(fp.bd_permissoes)) {
                    permissoesList = fp.bd_permissoes;
                  } else {
                    permissoesList = [fp.bd_permissoes];
                  }
                  
                  permissoesList.forEach((perm) => {
                    if (perm && perm.nome_permissao) {
                      userPermissions.add(perm.nome_permissao);
                    }
                  });
                }
              });
              permissions = Array.from(userPermissions);
            }

            // Buscar equipes permitidas usando a função RLS
            const { data: teamsData } = await supabase.rpc('get_user_allowed_teams');
            if (teamsData) {
              allowedTeams = teamsData;
            }
          } catch (error) {
            console.warn('⚠️ [RLS] Erro ao buscar permissões específicas:', error);
            // Manter permissões básicas em caso de erro
          }
        }

        console.log('✅ [RLS] Permissões RLS processadas:', {
          userId,
          email: profile?.email,
          funcoes,
          isSuperAdmin,
          userRole,
          permissions: permissions.length,
          allowedTeams: allowedTeams.length,
          canAccessDashboard: true
        });

        setState({
          userId,
          isSuperAdmin,
          userRole,
          permissions,
          allowedTeams,
          isLoading: false,
          canAccessDashboard: true,
        });

      } catch (error) {
        console.error('❌ [RLS] Erro crítico:', error);
        
        // Fallback de emergência para usuários autenticados
        setState({
          userId,
          isSuperAdmin: false,
          userRole: 'user',
          permissions: ['dashboard_view'],
          allowedTeams: [],
          isLoading: false,
          canAccessDashboard: true,
        });
      }
    };

    loadRLSPermissions();
  }, [userId, isAuthenticated, authLoading]);

  return state;
};
