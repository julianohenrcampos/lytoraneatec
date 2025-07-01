
import { useState } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { useToast } from './use-toast';
import { salvarApontamentoOffline } from '@/utils/salvarOffline';
import { ApontamentoEquipeApiData } from '@/types/apontamentoEquipe';
import { createApontamentoEquipe } from '@/services/apontamentoEquipeService';
import { useAuth } from './useAuth';

export const useApontamentoEquipeOffline = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { isSupabaseConnected } = useConnectionStatus();
  const { toast } = useToast();
  const { userId } = useAuth();

  const submitApontamento = async (
    formData: ApontamentoEquipeApiData,
    onSuccess?: () => void
  ) => {
    setIsLoading(true);
    
    try {
      if (isSupabaseConnected) {
        // Modo online - enviar diretamente para Supabase
        console.log('📡 Enviando apontamento online para Supabase...');
        
        await createApontamentoEquipe(formData);
        
        toast({
          title: "Apontamento registrado",
          description: "Apontamento de equipe salvo com sucesso",
          variant: "default"
        });
        
        onSuccess?.();
      } else {
        // Modo offline - salvar no localStorage
        console.log('📵 Salvando apontamento offline...');
        
        const id = salvarApontamentoOffline(
          'apontamento_equipe',
          formData,
          userId
        );
        
        toast({
          title: "Salvo offline",
          description: "Apontamento será sincronizado quando a internet voltar",
          variant: "default"
        });
        
        onSuccess?.();
      }
    } catch (error) {
      console.error('Erro ao submeter apontamento:', error);
      
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar apontamento",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitApontamento,
    isLoading,
    isOffline: !isSupabaseConnected
  };
};
