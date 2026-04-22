
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';

interface UserDataAccess {
  allowedTeamIds: string[];
  userRole: string | null;
  canAccessAllTeams: boolean;
  isLoading: boolean;
}

export const useUserDataAccess = (): UserDataAccess => {
  const { userRole, isSuperAdmin, isLoading: authLoading } = usePermission();
  const [allowedTeamIds, setAllowedTeamIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllowedTeams = async () => {
      if (authLoading || !userRole) return;

      try {
        setIsLoading(true);
        
        // SuperAdmin e AdmRH têm acesso a todas as equipes
        if (isSuperAdmin || userRole === 'AdmRH' || userRole === 'Administrador') {
          const { data: allTeams, error } = await supabase
            .from('bd_equipes')
            .select('id');
          
          if (error) throw error;
          setAllowedTeamIds(allTeams?.map(team => team.id) || []);
          return;
        }

        const { data: currentUser } = await supabase.auth.getUser();
        const userId = currentUser.user?.id;

        if (!userId) {
          setAllowedTeamIds([]);
          return;
        }

        // Buscar funcionário vinculado ao profile do usuário
        const { data: profile } = await supabase
          .from('vw_profile_self_safe')
          .select('funcionario_id')
          .eq('id', userId)
          .single();

        const funcionarioId = profile?.funcionario_id;

        if (!funcionarioId) {
          setAllowedTeamIds([]);
          return;
        }

        const { data: funcionario } = await supabase
          .from('bd_funcionarios')
          .select('id')
          .eq('id', funcionarioId)
          .single();

        if (!funcionario) {
          setAllowedTeamIds([]);
          return;
        }

        // Buscar equipes onde é apontador ou encarregado
        const { data: teams, error } = await supabase
          .from('bd_equipes')
          .select('id')
          .or(`apontador_id.eq.${funcionario.id},encarregado_id.eq.${funcionario.id}`);

        if (error) throw error;
        setAllowedTeamIds(teams?.map(team => team.id) || []);

      } catch (error) {
        console.error('Error fetching allowed teams:', error);
        setAllowedTeamIds([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllowedTeams();
  }, [userRole, isSuperAdmin, authLoading]);

  return {
    allowedTeamIds,
    userRole,
    canAccessAllTeams: isSuperAdmin || userRole === 'AdmRH' || userRole === 'Administrador',
    isLoading: isLoading || authLoading
  };
};
