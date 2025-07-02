
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserDataAccess {
  allowedTeamIds: string[];
  userRole: string | null;
  canAccessAllTeams: boolean;
  isLoading: boolean;
}

export const useUserDataAccessStable = (
  userId: string | null, 
  userRole: string | null, 
  isSuperAdmin: boolean
): UserDataAccess => {
  const [state, setState] = useState<UserDataAccess>({
    allowedTeamIds: [],
    userRole: null,
    canAccessAllTeams: false,
    isLoading: true,
  });

  useEffect(() => {
    const loadUserAccess = async () => {
      if (!userId) {
        setState({
          allowedTeamIds: [],
          userRole: null,
          canAccessAllTeams: false,
          isLoading: false,
        });
        return;
      }

      try {
        console.log('🔑 STABLE - Carregando acesso de dados para:', { userId, userRole, isSuperAdmin });

        // SuperAdmin pode acessar tudo - SEM FILTROS
        if (isSuperAdmin) {
          console.log('🔓 STABLE - SuperAdmin: Acesso total liberado - SEM FILTROS');
          setState({
            allowedTeamIds: [], // Array vazio indica "sem filtros" para SuperAdmin
            userRole,
            canAccessAllTeams: true,
            isLoading: false,
          });
          return;
        }

        // Administradores RH também podem acessar tudo
        if (userRole === 'AdmRH' || userRole === 'Administrador') {
          console.log('🔓 STABLE - Admin role: Acesso total liberado');
          setState({
            allowedTeamIds: [],
            userRole,
            canAccessAllTeams: true,
            isLoading: false,
          });
          return;
        }

        // Para outros usuários, buscar equipes específicas
        console.log('🔍 STABLE - Buscando equipes específicas do usuário');

        // Buscar o funcionário pelo email
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single();

        if (!profile?.email) {
          console.log('⚠️ STABLE - Email não encontrado no perfil');
          setState({
            allowedTeamIds: [],
            userRole,
            canAccessAllTeams: false,
            isLoading: false,
          });
          return;
        }

        // Buscar funcionário pelo email
        const { data: funcionario } = await supabase
          .from('bd_funcionarios')
          .select('id')
          .eq('email', profile.email)
          .single();

        if (!funcionario) {
          console.log('⚠️ STABLE - Funcionário não encontrado');
          setState({
            allowedTeamIds: [],
            userRole,
            canAccessAllTeams: false,
            isLoading: false,
          });
          return;
        }

        // Buscar equipes onde o usuário é apontador ou encarregado
        const { data: equipes, error } = await supabase
          .from('bd_equipes')
          .select('id')
          .or(`apontador_id.eq.${funcionario.id},encarregado_id.eq.${funcionario.id}`);

        if (error) {
          console.error('❌ STABLE - Erro ao buscar equipes:', error);
          setState({
            allowedTeamIds: [],
            userRole,
            canAccessAllTeams: false,
            isLoading: false,
          });
          return;
        }

        const teamIds = equipes?.map(eq => eq.id) || [];
        
        console.log('✅ STABLE - Equipes encontradas:', teamIds);

        setState({
          allowedTeamIds: teamIds,
          userRole,
          canAccessAllTeams: false,
          isLoading: false,
        });

      } catch (error) {
        console.error('❌ STABLE - Erro ao carregar acesso:', error);
        setState({
          allowedTeamIds: [],
          userRole,
          canAccessAllTeams: false,
          isLoading: false,
        });
      }
    };

    loadUserAccess();
  }, [userId, userRole, isSuperAdmin]);

  return state;
};
