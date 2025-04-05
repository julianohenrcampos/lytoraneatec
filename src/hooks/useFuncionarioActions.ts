
import { useCallback, useState } from "react";
import { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import { useFuncionarioState } from "./funcionarios/useFuncionarioState";
import { useFuncionarioQueries } from "./funcionarios/useFuncionarioQueries";
import { useFuncionarioExcel } from "./funcionarios/useFuncionarioExcel";
import { useFuncionarioImport } from "./funcionarios/useFuncionarioImport";

export function useFuncionarioActions() {
  // Use all the smaller hooks
  const state = useFuncionarioState();
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | undefined>();
  
  const { 
    funcionarios, 
    isLoading, 
    isError, 
    refetch,
    createMutation,
    updateMutation,
    deleteMutation
  } = useFuncionarioQueries(
    state.filters,
    () => state.setIsFormModalOpen(false),
    () => state.setIsFormModalOpen(false),
    () => {
      state.setIsDeleteModalOpen(false);
      state.setDeletingFuncionario(null);
      setDeleteErrorMessage(undefined);
    },
    () => state.setIsSubmitting(false),
    () => state.setIsDeleting(false)
  );

  const { exportToExcel } = useFuncionarioExcel(funcionarios);
  
  const { handleImport } = useFuncionarioImport(() => {
    state.setIsImportModalOpen(false);
    state.setIsImporting(false);
  });

  // Manipuladores de eventos
  const handleFilterChange = useCallback((name: string, value: string) => {
    state.setFilters(prev => ({
      ...prev,
      [name]: value || undefined
    }));
  }, [state]);

  const resetFilters = useCallback(() => {
    state.setFilters({});
  }, [state]);

  const openFormModal = useCallback((funcionario?: Funcionario) => {
    state.setCurrentFuncionario(funcionario || null);
    state.setIsFormModalOpen(true);
  }, [state]);

  const openDetailsModal = useCallback((funcionario: Funcionario) => {
    state.setCurrentFuncionario(funcionario);
    state.setIsDetailsModalOpen(true);
  }, [state]);

  const confirmDelete = useCallback((funcionario: Funcionario) => {
    state.setDeletingFuncionario(funcionario);
    state.setIsDeleteModalOpen(true);
    setDeleteErrorMessage(undefined);
  }, [state]);

  const handleDelete = useCallback(() => {
    if (state.deletingFuncionario) {
      state.setIsDeleting(true);
      deleteMutation.mutate(state.deletingFuncionario.id, {
        onError: (error: Error) => {
          setDeleteErrorMessage(error.message);
        }
      });
    }
  }, [state.deletingFuncionario, deleteMutation, state]);

  // Handler para salvar funcionário (criar ou atualizar)
  const handleSaveFuncionario = useCallback((data: FuncionarioFormData) => {
    state.setIsSubmitting(true);
    if (state.currentFuncionario) {
      // Atualizar funcionário existente
      updateMutation.mutate({ id: state.currentFuncionario.id, data });
    } else {
      // Criar novo funcionário
      createMutation.mutate(data);
    }
  }, [state, createMutation, updateMutation]);

  return {
    // Estado
    filters: state.filters,
    currentFuncionario: state.currentFuncionario,
    isFormModalOpen: state.isFormModalOpen,
    isDetailsModalOpen: state.isDetailsModalOpen,
    isImportModalOpen: state.isImportModalOpen,
    isDeleteModalOpen: state.isDeleteModalOpen,
    deletingFuncionario: state.deletingFuncionario,
    isDeleting: state.isDeleting,
    isImporting: state.isImporting,
    isSubmitting: state.isSubmitting,
    deleteErrorMessage,
    funcionarios,
    isLoading,
    isError,
    
    // Ações
    setIsFormModalOpen: state.setIsFormModalOpen,
    setIsDetailsModalOpen: state.setIsDetailsModalOpen,
    setIsImportModalOpen: state.setIsImportModalOpen,
    setIsDeleteModalOpen: state.setIsDeleteModalOpen,
    handleFilterChange,
    resetFilters,
    openFormModal,
    openDetailsModal,
    confirmDelete,
    handleDelete,
    handleSaveFuncionario,
    refetch,
    exportToExcel,
    handleImport
  };
}
