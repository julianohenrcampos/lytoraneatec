
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

        // Para outros usuários, buscar equipes específicas com retry
        console.log('🔍 STABLE - Buscando equipes específicas do usuário');

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            // Buscar o funcionário pelo email
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', userId)
              .single();

            if (profileError) {
              console.warn(`⚠️ STABLE - Erro ao buscar perfil (tentativa ${retryCount + 1}):`, profileError);
              if (retryCount === maxRetries - 1) throw profileError;
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              continue;
            }

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
            const { data: funcionario, error: funcionarioError } = await supabase
              .from('bd_funcionarios')
              .select('id')
              .eq('email', profile.email)
              .single();

            if (funcionarioError) {
              console.warn(`⚠️ STABLE - Erro ao buscar funcionário (tentativa ${retryCount + 1}):`, funcionarioError);
              if (retryCount === maxRetries - 1) throw funcionarioError;
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              continue;
            }

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
            const { data: equipes, error: equipesError } = await supabase
              .from('bd_equipes')
              .select('id')
              .or(`apontador_id.eq.${funcionario.id},encarregado_id.eq.${funcionario.id}`);

            if (equipesError) {
              console.warn(`⚠️ STABLE - Erro ao buscar equipes (tentativa ${retryCount + 1}):`, equipesError);
              if (retryCount === maxRetries - 1) throw equipesError;
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              continue;
            }

            const teamIds = equipes?.map(eq => eq.id) || [];
            
            console.log('✅ STABLE - Equipes encontradas:', teamIds);

            setState({
              allowedTeamIds: teamIds,
              userRole,
              canAccessAllTeams: false,
              isLoading: false,
            });
            
            break; // Sucesso, sair do loop
            
          } catch (innerError) {
            retryCount++;
            if (retryCount >= maxRetries) {
              throw innerError;
            }
            console.warn(`🔄 STABLE - Retry ${retryCount}/${maxRetries} após erro:`, innerError);
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }

      } catch (error) {
        console.error('❌ STABLE - Erro final ao carregar acesso:', error);
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
