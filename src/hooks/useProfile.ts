import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { hasRole } from '@/utils/roleUtils';

interface Profile {
  id: string;
  email: string | null;
  nome_completo: string | null;
  funcao_sistema: string | null;
  funcoes: string[] | null;
  funcionario_id: string | null;
  equipes: string[];
}

interface UseProfileReturn {
  perfil: Profile | null;
  isLoading: boolean;
  error: string | null;
}

export const useProfile = (): UseProfileReturn => {
  const { user, isAuthenticated } = useAuth();
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setPerfil(null);
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        if (!profile) {
          setError('Perfil não encontrado');
          return;
        }

        // Auto-vinculação do funcionario_id se for Apontador/Encarregado sem vinculação
        let updatedProfile = { ...profile };
        
        if (!profile.funcionario_id && profile.funcoes && 
            (hasRole(profile.funcoes, 'Apontador') || hasRole(profile.funcoes, 'Encarregado'))) {
          
          console.log('🔄 Tentando auto-vincular funcionário por email:', profile.email);
          
          const { data: funcionario } = await supabase
            .from('bd_funcionarios')
            .select('id, nome_completo')
            .eq('email', profile.email)
            .eq('status', 'Ativo')
            .single();
            
          if (funcionario) {
            console.log('✅ Funcionário encontrado:', funcionario.nome_completo);
            
            // Atualizar o perfil com o funcionario_id
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ funcionario_id: funcionario.id })
              .eq('id', user.id);
              
            if (!updateError) {
              updatedProfile.funcionario_id = funcionario.id;
              console.log('✅ Profile atualizado com funcionario_id:', funcionario.id);
            }
          }
        }

        // Sincronizar funcao_sistema com array funcoes
        let funcaoSistemaAtualizada = profile.funcao_sistema;
        
        if (profile.funcoes && profile.funcoes.length > 0) {
          // Priorizar funções mais específicas
          if (hasRole(profile.funcoes, 'SuperAdm')) {
            funcaoSistemaAtualizada = 'SuperAdm';
          } else if (hasRole(profile.funcoes, 'Administrador')) {
            funcaoSistemaAtualizada = 'Administrador';
          } else if (hasRole(profile.funcoes, 'AdmRH')) {
            funcaoSistemaAtualizada = 'AdmRH';
          } else if (hasRole(profile.funcoes, 'AdmLogistica')) {
            funcaoSistemaAtualizada = 'AdmLogistica';
          } else if (hasRole(profile.funcoes, 'AdmEquipamentos')) {
            funcaoSistemaAtualizada = 'AdmEquipamentos';
          } else if (hasRole(profile.funcoes, 'Encarregado')) {
            funcaoSistemaAtualizada = 'Encarregado';
          } else if (hasRole(profile.funcoes, 'Apontador')) {
            funcaoSistemaAtualizada = 'Apontador';
          }
          
          // Atualizar se mudou
          if (funcaoSistemaAtualizada !== profile.funcao_sistema) {
            console.log('🔄 Sincronizando funcao_sistema:', profile.funcao_sistema, '->', funcaoSistemaAtualizada);
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ funcao_sistema: funcaoSistemaAtualizada })
              .eq('id', user.id);
              
            if (!updateError) {
              updatedProfile.funcao_sistema = funcaoSistemaAtualizada;
              console.log('✅ funcao_sistema atualizada');
            }
          }
        }

        // Buscar equipes onde o usuário é apontador ou encarregado
        let equipes: string[] = [];
        
        if (updatedProfile.funcionario_id) {
          const { data: equipesData } = await supabase
            .from('bd_equipes')
            .select('id')
            .or(`apontador_id.eq.${updatedProfile.funcionario_id},encarregado_id.eq.${updatedProfile.funcionario_id}`);
          
          equipes = equipesData?.map(equipe => equipe.id) || [];
          
          console.log('📋 Equipes encontradas para funcionário:', equipes.length);
        }

        setPerfil({
          id: updatedProfile.id,
          email: updatedProfile.email,
          nome_completo: updatedProfile.nome_completo,
          funcao_sistema: updatedProfile.funcao_sistema,
          funcoes: updatedProfile.funcoes,
          funcionario_id: updatedProfile.funcionario_id,
          equipes
        });

      } catch (err) {
        console.error('Erro ao buscar perfil:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, isAuthenticated]);

  return { perfil, isLoading, error };
};