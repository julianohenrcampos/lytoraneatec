import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

        // Buscar equipes onde o usuário é apontador ou encarregado
        let equipes: string[] = [];
        
        if (profile.funcionario_id) {
          const { data: equipesData } = await supabase
            .from('bd_equipes')
            .select('id')
            .or(`apontador_id.eq.${profile.funcionario_id},encarregado_id.eq.${profile.funcionario_id}`);
          
          equipes = equipesData?.map(equipe => equipe.id) || [];
        }

        setPerfil({
          id: profile.id,
          email: profile.email,
          nome_completo: profile.nome_completo,
          funcao_sistema: profile.funcao_sistema,
          funcoes: profile.funcoes,
          funcionario_id: profile.funcionario_id,
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