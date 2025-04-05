import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchFuncionarios, 
  createFuncionario, 
  updateFuncionario, 
  deleteFuncionario,
  checkFuncionarioReferences
} from "@/services/funcionarioService";
import { FuncionarioFilter, FuncionarioFormData } from "@/types/funcionario";
import { useToast } from "../use-toast";

export function useFuncionarioQueries(
  filters: FuncionarioFilter,
  onSuccessCreate?: () => void,
  onSuccessUpdate?: () => void,
  onSuccessDelete?: () => void,
  onSettledSubmit?: () => void,
  onSettledDelete?: () => void
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query para buscar funcionários
  const { 
    data: funcionarios, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery({
    queryKey: ['funcionarios', filters],
    queryFn: () => fetchFuncionarios(filters)
  });

  // Mutation para criar funcionário
  const createMutation = useMutation({
    mutationFn: (data: FuncionarioFormData) => createFuncionario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      toast({
        title: "Funcionário criado",
        description: "O funcionário foi criado com sucesso."
      });
      if (onSuccessCreate) onSuccessCreate();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      if (onSettledSubmit) onSettledSubmit();
    }
  });

  // Mutation para atualizar funcionário
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FuncionarioFormData }) => 
      updateFuncionario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      toast({
        title: "Funcionário atualizado",
        description: "O funcionário foi atualizado com sucesso."
      });
      if (onSuccessUpdate) onSuccessUpdate();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      if (onSettledSubmit) onSettledSubmit();
    }
  });

  // Mutation para excluir funcionário
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro verifica se há referências ao funcionário
      const references = await checkFuncionarioReferences(id);
      if (references.hasReferences) {
        throw new Error(
          `Não é possível excluir este funcionário pois existem referências em: ${references.referencedIn.join(', ')}`
        );
      }
      return deleteFuncionario(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      toast({
        title: "Funcionário excluído",
        description: "O funcionário foi excluído com sucesso."
      });
      if (onSuccessDelete) onSuccessDelete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive"
      });
    },
    onSettled: () => {
      if (onSettledDelete) onSettledDelete();
    }
  });

  return {
    funcionarios,
    isLoading,
    isError,
    refetch,
    createMutation,
    updateMutation,
    deleteMutation
  };
}
