import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
  importVeiculos
} from "@/services/veiculo";
import { Veiculo } from "@/types/veiculo";
import { VeiculoFormData } from "@/services/veiculo/types";

export const useVeiculoMutations = (
  onSuccessCallback?: () => void,
  onCreateSuccess?: () => void,
  onUpdateSuccess?: () => void,
  onDeleteSuccess?: () => void,
  onImportSuccess?: () => void
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: VeiculoFormData) => createVeiculo(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['disponibilidades'] });
      queryClient.invalidateQueries({ queryKey: ['mapa-operacional'] });
      queryClient.invalidateQueries({ queryKey: ['equipamentos-dd'] });
      toast({
        title: "Sucesso",
        description: "Veículo/Equipamento criado com sucesso!",
      });
      if (onSuccessCallback) onSuccessCallback();
      if (onCreateSuccess) onCreateSuccess();
    },
    onError: (error: any) => {
      console.error("Erro ao criar veículo/equipamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o veículo/equipamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VeiculoFormData> }) => updateVeiculo(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      toast({
        title: "Sucesso",
        description: "Veículo/Equipamento atualizado com sucesso!",
      });
      if (onSuccessCallback) onSuccessCallback();
      if (onUpdateSuccess) onUpdateSuccess();
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar veículo/equipamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o veículo/equipamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVeiculo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['equipamentos-dd'] });
      toast({
        title: "Sucesso",
        description: "Veículo/Equipamento excluído com sucesso!",
      });
      if (onSuccessCallback) onSuccessCallback();
      if (onDeleteSuccess) onDeleteSuccess();
    },
    onError: (error: any) => {
      console.error("Erro ao excluir veículo/equipamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o veículo/equipamento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (veiculos: VeiculoFormData[] | File) => importVeiculos(veiculos),
    onSuccess: (result: { success: any[]; errors: any[] }) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['equipamentos-dd'] });


      if (result.success.length > 0) {
        toast({
          title: "Importação concluída",
          description: `${result.success.length} veículos/equipamentos importados com sucesso!`,
        });
        if (onSuccessCallback) onSuccessCallback();
        if (onImportSuccess) onImportSuccess();
      } else {
        toast({
          title: "Importação falhou",
          description: `Nenhum veículo/equipamento importado. ${result.errors.length} erros encontrados.`,
          variant: "destructive",
        });
      }
      
      return result;
    },
    onError: (error: any) => {
      console.error("Erro ao importar veículos/equipamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível importar os veículos/equipamentos. Tente novamente.",
        variant: "destructive",
      });
      
      return {
        success: [],
        errors: [{ message: error.message || "Erro ao importar veículos" }]
      };
    },
  });

  return {
    createVeiculo: createMutation.mutate,
    createVeiculoAsync: (data: VeiculoFormData) => createMutation.mutateAsync(data),
    isCreating: createMutation.isPending,
    updateVeiculo: (id: string, data: Partial<Veiculo>) => updateMutation.mutate({ id, data }),
    updateVeiculoAsync: (id: string, data: Partial<Veiculo>) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteVeiculo: deleteMutation.mutate,
    deleteVeiculoAsync: (id: string) => deleteMutation.mutateAsync(id),
    isDeleting: deleteMutation.isPending,
    importVeiculos: (data: VeiculoFormData[] | File) => {
      return importMutation.mutateAsync(data);
    },
    isImporting: importMutation.isPending,
  };
};

