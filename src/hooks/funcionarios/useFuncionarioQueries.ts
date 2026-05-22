import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFuncionarios,
  createFuncionario,
  updateFuncionario,
  inativarFuncionario,
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
  const { departamentoId, centroCustoIds, shouldFilterByDepartment, shouldFilterByCentroCusto, isLoading: isSecurityLoading } = useRhSecurity();

  // Escopo agora é aplicado server-side pela RPC fn_rh_funcionarios_listar.
  // Aqui só repassamos o filtro de CC do usuário se ele explicitamente escolheu um.
  // Mantemos a injeção de departamento_id para perfis cuja política RH atual exige
  // (AdmSede/AdmSSO/AdmTec... quando shouldFilterByDepartment=true).
  const secureFilters: FuncionarioFilter = (() => {
    if (shouldFilterByDepartment && departamentoId) {
      return { ...filters, departamento_id: departamentoId };
    }
    // Para GerenteRegional/AdmOBRA: não injetamos centro_custo_ids — escopo é server-side.
    const { centro_custo_ids: _omit, ...rest } = filters;
    return rest;
  })();


  // Query para buscar funcionários
  const { 
    data: funcionarios, 
    isLoading: isQueryLoading, 
    isError,
    error,
    refetch 
  } = useQuery({
    queryKey: ['funcionarios', secureFilters, departamentoId, shouldFilterByDepartment, shouldFilterByCentroCusto],
    queryFn: async () => {
      const result = await fetchFuncionarios(secureFilters);
      if (import.meta.env.DEV) {
        const mode = secureFilters.centro_custo_ids?.length
          ? 'cc'
          : secureFilters.centro_custo_id
            ? 'cc-single'
            : secureFilters.departamento_id
              ? 'dept'
              : 'none';
        console.log('[AUDIT][rh-funcionarios:list]', {
          mode,
          centroCustoIdsCount: secureFilters.centro_custo_ids?.length ?? 0,
          departamentoId: secureFilters.departamento_id ?? null,
          returnedCount: Array.isArray(result) ? result.length : 0,
        });
      }
      return result;
    },
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
    onSuccess: (result: any) => {
      const noChange = result && result.__noChange === true;
      if (!noChange) {
        queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      }
      if (onSuccessUpdate) onSuccessUpdate();
      if (onCenterAlert) {
        onCenterAlert(noChange ? "Nenhuma alteração detectada" : "Salvo com sucesso", noChange ? "warning" : "success");
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


  // Mutation para INATIVAR funcionário (soft delete).
  // Sem DELETE físico nesta rodada — nem para SuperAdm.
  // Preserva histórico, vínculos e auditoria.
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("⏸️ Iniciando inativação de funcionário:", id);
      return inativarFuncionario(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      toast({
        title: "Funcionário inativado",
        description: "O funcionário foi inativado. O histórico e os vínculos foram preservados."
      });
      if (onSuccessDelete) onSuccessDelete();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao inativar",
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
