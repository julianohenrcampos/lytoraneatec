import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchFuncionarios, 
  createFuncionario, 
  updateFuncionario, 
  deleteFuncionario,
  deleteFuncionarioWithBypass,
  checkFuncionarioReferences
} from "@/services/funcionarioService";
import { FuncionarioFilter, FuncionarioFormData } from "@/types/funcionario";
import { useToast } from "../use-toast";
import { useRhSecurity } from "../dashboard/useRhSecurity";

export function useFuncionarioQueries(
  filters: FuncionarioFilter,
  onSuccessCreate?: () => void,
  onSuccessUpdate?: () => void,
  onSuccessDelete?: () => void,
  onSettledSubmit?: () => void,
  onSettledDelete?: () => void,
  onCenterAlert?: (message: string, type: "success" | "error" | "warning") => void
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { departamentoId, shouldFilterByDepartment, isLoading: isSecurityLoading } = useRhSecurity();

  // Aplicar filtro de departamento automaticamente para usuários com acesso restrito
  const secureFilters: FuncionarioFilter = shouldFilterByDepartment && departamentoId
    ? { ...filters, departamento_id: departamentoId }
    : filters;

  // Query para buscar funcionários
  const { 
    data: funcionarios, 
    isLoading: isQueryLoading, 
    isError,
    error,
    refetch 
  } = useQuery({
    queryKey: ['funcionarios', secureFilters, departamentoId, shouldFilterByDepartment],
    queryFn: () => fetchFuncionarios(secureFilters),
    enabled: !isSecurityLoading, // Aguarda carregar o contexto de segurança
    retry: 1, // Tentar apenas uma vez (fallback já é tentado internamente)
  });

  const isLoading = isSecurityLoading || isQueryLoading;

  // Mutation para criar funcionário
  const createMutation = useMutation({
    mutationFn: (data: FuncionarioFormData) => createFuncionario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      if (onSuccessCreate) onSuccessCreate();
      if (onCenterAlert) {
        onCenterAlert("Salvo com sucesso", "success");
      }
    },
    onError: (error: Error) => {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("cpf") || msg.includes("duplicate") || msg.includes("já existe") || msg.includes("unique")) {
        if (onCenterAlert) {
          onCenterAlert("Funcionário já existente", "error");
        }
      } else {
        if (onCenterAlert) {
          onCenterAlert(error.message || "Erro ao criar funcionário", "error");
        }
      }
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
      if (onSuccessUpdate) onSuccessUpdate();
      if (onCenterAlert) {
        onCenterAlert("Salvo com sucesso", "success");
      }
    },
    onError: (error: Error) => {
      if (onCenterAlert) {
        onCenterAlert(error.message || "Erro ao atualizar funcionário", "error");
      }
    },
    onSettled: () => {
      if (onSettledSubmit) onSettledSubmit();
    }
  });

  // Mutation para excluir funcionário
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("🔐 Iniciando exclusão de funcionário:", id);
      
      // Primeiro verifica se há referências ao funcionário
      const references = await checkFuncionarioReferences(id);
      if (references.hasReferences) {
        console.warn("⚠️ Funcionário possui referências:", references.referencedIn);
        
        // Tentar bypass para SuperAdmin
        try {
          console.log("🔓 Tentando bypass SuperAdmin para exclusão...");
          await deleteFuncionarioWithBypass(id);
          console.log("✅ Bypass SuperAdmin executado com sucesso");
          return;
        } catch (bypassError) {
          console.error("❌ Bypass SuperAdmin falhou:", bypassError);
          throw new Error(
            `Não é possível excluir este funcionário pois existem referências em: ${references.referencedIn.join(', ')}`
          );
        }
      }
      
      console.log("✅ Funcionário pode ser excluído normalmente, prosseguindo...");
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
    error, // Expose error object for detailed display
    refetch,
    createMutation,
    updateMutation,
    deleteMutation
  };
}
