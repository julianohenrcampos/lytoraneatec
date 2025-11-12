import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cleanFunctionArray } from '@/utils/permissionValidation';

export const useRemoverPermissoes = () => {
  const [isRemoving, setIsRemoving] = useState(false);

  const removerFuncaoIndividual = async (
    profileId: string,
    funcaoToRemove: string,
    currentFunctions: string[]
  ) => {
    setIsRemoving(true);
    try {
      // Remover a função do array
      const updatedFunctions = currentFunctions.filter(f => f !== funcaoToRemove);
      const cleanedFunctions = cleanFunctionArray(updatedFunctions);

      // Atualizar no banco
      const { error } = await supabase
        .from('profiles')
        .update({ 
          funcoes: cleanedFunctions,
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId);

      if (error) throw error;

      console.log('Função removida:', {
        profileId,
        funcaoRemovida: funcaoToRemove,
        funcoesRestantes: cleanedFunctions,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Função removida',
        description: `A função "${funcaoToRemove}" foi removida com sucesso.`,
      });

      return { success: true, updatedFunctions: cleanedFunctions };
    } catch (error) {
      console.error('Erro ao remover função:', error);
      toast({
        title: 'Erro ao remover função',
        description: 'Não foi possível remover a função. Tente novamente.',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsRemoving(false);
    }
  };

  const removerTodasFuncoes = async (
    profileId: string,
    profileEmail: string,
    currentFunctions: string[]
  ) => {
    setIsRemoving(true);
    try {
      // Remover todas as funções (deixar apenas 'user' como padrão)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          funcoes: ['user'],
          funcao_permissao: null,
          funcao_sistema: 'Usuário',
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId);

      if (error) throw error;

      console.log('Todas as permissões removidas:', {
        profileId,
        profileEmail,
        funcoesRemovidas: currentFunctions,
        removidoPor: (await supabase.auth.getUser()).data.user?.email,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Permissões removidas',
        description: `Todas as permissões administrativas foram removidas de ${profileEmail}.`,
      });

      return { success: true };
    } catch (error) {
      console.error('Erro ao remover todas as funções:', error);
      toast({
        title: 'Erro ao remover permissões',
        description: 'Não foi possível remover as permissões. Tente novamente.',
        variant: 'destructive',
      });
      return { success: false };
    } finally {
      setIsRemoving(false);
    }
  };

  return {
    removerFuncaoIndividual,
    removerTodasFuncoes,
    isRemoving,
  };
};
