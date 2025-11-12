import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissionCacheInvalidation } from "@/hooks/usePermissionCacheInvalidation";

export const useVincularFuncionario = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidatePermissionCache } = usePermissionCacheInvalidation();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const vincularFuncionarioMutation = useMutation({
    mutationFn: async (params: { 
      profileId: string; 
      funcionarioId: string;
    }) => {
      const { profileId, funcionarioId } = params;
      console.log('🔗 Vinculando funcionário:', { profileId, funcionarioId });
      
      // Buscar dados do funcionário (incluindo departamento)
      const { data: funcionario, error: fetchError } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, departamento_id, bd_departamentos(nome_departamento)')
        .eq('id', funcionarioId)
        .single();
      
      if (fetchError || !funcionario) {
        throw new Error('Funcionário não encontrado');
      }

      // Atualizar profile com funcionario_id
      const { error } = await supabase
        .from('profiles')
        .update({ funcionario_id: funcionarioId })
        .eq('id', profileId);
      
      if (error) throw error;
      
      console.log('✅ Funcionário vinculado com sucesso');
      return { 
        profileId, 
        funcionarioId,
        departamento: funcionario.bd_departamentos?.nome_departamento || null
      };
    },
    onSuccess: (data) => {
      const departamentoMsg = data.departamento 
        ? `ao departamento ${data.departamento}` 
        : 'sem departamento (acesso global)';
      
      toast({
        title: "Funcionário vinculado com sucesso",
        description: `Usuário agora está vinculado ${departamentoMsg}`,
        variant: "default",
      });
      
      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      invalidatePermissionCache();
      
      setIsLinkModalOpen(false);
      setSelectedProfileId(null);
    },
    onError: (error: any) => {
      console.error('❌ Erro ao vincular funcionário:', error);
      toast({
        title: "Erro ao vincular funcionário",
        description: error.message || "Não foi possível vincular o funcionário.",
        variant: "destructive",
      });
    }
  });

  const desvincularFuncionarioMutation = useMutation({
    mutationFn: async (profileId: string) => {
      console.log('🔓 Desvinculando funcionário do profile:', profileId);
      
      const { error } = await supabase
        .from('profiles')
        .update({ funcionario_id: null })
        .eq('id', profileId);
      
      if (error) throw error;
      
      console.log('✅ Funcionário desvinculado com sucesso');
      return { profileId };
    },
    onSuccess: () => {
      toast({
        title: "Funcionário desvinculado",
        description: "⚠️ Este usuário agora tem acesso global a todos os dados.",
        variant: "default",
      });
      
      // Invalidar caches
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      console.error('❌ Erro ao desvincular funcionário:', error);
      toast({
        title: "Erro ao desvincular funcionário",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const openLinkModal = (profileId: string) => {
    setSelectedProfileId(profileId);
    setIsLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setIsLinkModalOpen(false);
    setSelectedProfileId(null);
  };

  const handleVincularFuncionario = (profileId: string, funcionarioId: string) => {
    vincularFuncionarioMutation.mutate({ profileId, funcionarioId });
  };

  return {
    isLinkModalOpen,
    selectedProfileId,
    openLinkModal,
    closeLinkModal,
    vincularFuncionario: handleVincularFuncionario,
    desvincularFuncionario: desvincularFuncionarioMutation.mutate,
    isVinculando: vincularFuncionarioMutation.isPending,
    isDesvinculando: desvincularFuncionarioMutation.isPending,
  };
};
