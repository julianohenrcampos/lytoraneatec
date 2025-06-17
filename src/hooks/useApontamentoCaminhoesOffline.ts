
import { useState } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { useToast } from './use-toast';
import { salvarApontamentoOffline } from '@/utils/salvarOffline';
import { createApontamento } from '@/services/apontamentoCaminhoesService'; // Fixed import
import { useAuth } from './useAuth';

export const useApontamentoCaminhoesOffline = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { isSupabaseConnected } = useConnectionStatus();
  const { toast } = useToast();
  const { userId } = useAuth(); // Fixed property name

  const submitApontamento = async (
    formData: any,
    onSuccess?: () => void
  ) => {
    setIsLoading(true);
    
    try {
      if (isSupabaseConnected) {
        // Modo online - enviar diretamente para Supabase
        console.log('📡 Enviando apontamento de caminhões online...');
        
        await createApontamento(formData); // Fixed function name
        
        toast({
          title: "Apontamento registrado",
          description: "Apontamento de caminhões salvo com sucesso",
          variant: "default"
        });
        
        onSuccess?.();
      } else {
        // Modo offline - salvar no localStorage
        console.log('📵 Salvando apontamento de caminhões offline...');
        
        const id = salvarApontamentoOffline(
          'apontamento_caminhoes',
          formData,
          userId // Fixed property name
        );
        
        toast({
          title: "Salvo offline",
          description: "Apontamento será sincronizado quando a internet voltar",
          variant: "default"
        });
        
        onSuccess?.();
      }
    } catch (error) {
      console.error('Erro ao submeter apontamento de caminhões:', error);
      
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
