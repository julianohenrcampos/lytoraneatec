import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { clearUserAdminRolesSecure, removeUserRole } from '@/services/rbac';

export const useRemoverPermissoes = () => {
  const [isRemoving, setIsRemoving] = useState(false);

  const removerFuncaoIndividual = async (
    profileId: string,
    funcaoToRemove: string,
    currentFunctions: string[],
    roleId?: string
  ) => {
    setIsRemoving(true);
    try {
      if (!roleId) {
        throw new Error('Função RBAC não identificada para remoção segura.');
      }

      await removeUserRole(profileId, roleId);

      console.log('Função removida:', {
        profileId,
        funcaoRemovida: funcaoToRemove,
        funcoesRestantes: currentFunctions.filter(f => f !== funcaoToRemove),
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Função removida',
        description: `A função "${funcaoToRemove}" foi removida com sucesso.`,
      });

      return { success: true, updatedFunctions: currentFunctions.filter(f => f !== funcaoToRemove) };
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
      await clearUserAdminRolesSecure(profileId);

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
