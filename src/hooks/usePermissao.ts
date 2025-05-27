
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Permissao, 
  PermissaoFilter, 
  FuncaoPermissao, 
  FuncaoPermissaoFilter, 
  PermissaoFormData, 
  FuncaoPermissaoFormData 
} from "@/types/permissao";
import {
  fetchPermissoes,
  fetchFuncoesPermissao,
  createPermissao,
  updatePermissao,
  deletePermissao,
  createFuncaoPermissao,
  updateFuncaoPermissao,
  deleteFuncaoPermissao
} from "@/services/permissaoService";

export const usePermissao = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form states
  const [isPermissaoFormOpen, setIsPermissaoFormOpen] = useState(false);
  const [isFuncaoFormOpen, setIsFuncaoFormOpen] = useState(false);
  const [isDeletePermissaoOpen, setIsDeletePermissaoOpen] = useState(false);
  const [isDeleteFuncaoPermissaoOpen, setIsDeleteFuncaoPermissaoOpen] = useState(false);
  const [currentPermissao, setCurrentPermissao] = useState<Permissao | null>(null);
  const [currentFuncaoPermissao, setCurrentFuncaoPermissao] = useState<FuncaoPermissao | null>(null);
  
  // Filter states
  const [permissaoFilter, setPermissaoFilter] = useState<PermissaoFilter>({});
  const [funcaoPermissaoFilter, setFuncaoPermissaoFilter] = useState<FuncaoPermissaoFilter>({});
  
  // Queries
  const {
    data: permissoes,
    isLoading: isPermissaoLoading,
    refetch: refetchPermissoes
  } = useQuery({
    queryKey: ['permissoes', permissaoFilter],
    queryFn: () => fetchPermissoes(permissaoFilter)
  });
  
  const {
    data: funcoesPermissao,
    isLoading: isFuncaoPermissaoLoading,
    refetch: refetchFuncoesPermissao
  } = useQuery({
    queryKey: ['funcoesPermissao', funcaoPermissaoFilter],
    queryFn: () => fetchFuncoesPermissao(funcaoPermissaoFilter)
  });
  
  const {
    data: allPermissoes,
  } = useQuery({
    queryKey: ['allPermissoes'],
    queryFn: () => fetchPermissoes({})
  });
  
  // Mutations
  const createPermissaoMutation = useMutation({
    mutationFn: (data: PermissaoFormData) => createPermissao(data),
    onSuccess: () => {
      toast({
        title: "Permissão criada com sucesso",
        variant: "default",
      });
      setIsPermissaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['permissoes'] });
      queryClient.invalidateQueries({ queryKey: ['allPermissoes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar permissão",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const updatePermissaoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PermissaoFormData }) => updatePermissao(id, data),
    onSuccess: () => {
      toast({
        title: "Permissão atualizada com sucesso",
        variant: "default",
      });
      setIsPermissaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['permissoes'] });
      queryClient.invalidateQueries({ queryKey: ['allPermissoes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar permissão",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const deletePermissaoMutation = useMutation({
    mutationFn: (id: string) => deletePermissao(id),
    onSuccess: () => {
      toast({
        title: "Permissão excluída com sucesso",
        variant: "default",
      });
      setIsDeletePermissaoOpen(false);
      queryClient.invalidateQueries({ queryKey: ['permissoes'] });
      queryClient.invalidateQueries({ queryKey: ['allPermissoes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir permissão",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const createFuncaoPermissaoMutation = useMutation({
    mutationFn: (data: FuncaoPermissaoFormData) => createFuncaoPermissao(data),
    onSuccess: () => {
      toast({
        title: "Função criada com sucesso",
        variant: "default",
      });
      setIsFuncaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['funcoesPermissao'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar função",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const updateFuncaoPermissaoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FuncaoPermissaoFormData }) => updateFuncaoPermissao(id, data),
    onSuccess: () => {
      toast({
        title: "Função atualizada com sucesso",
        variant: "default",
      });
      setIsFuncaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['funcoesPermissao'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar função",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const deleteFuncaoPermissaoMutation = useMutation({
    mutationFn: (id: string) => deleteFuncaoPermissao(id),
    onSuccess: () => {
      toast({
        title: "Função excluída com sucesso",
        variant: "default",
      });
      setIsDeleteFuncaoPermissaoOpen(false);
      queryClient.invalidateQueries({ queryKey: ['funcoesPermissao'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir função",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Filter handlers
  const handlePermissaoFilterChange = (name: string, value: any) => {
    setPermissaoFilter(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFuncaoPermissaoFilterChange = (name: string, value: any) => {
    setFuncaoPermissaoFilter(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const resetPermissaoFilters = () => {
    setPermissaoFilter({});
  };
  
  const resetFuncaoPermissaoFilters = () => {
    setFuncaoPermissaoFilter({});
  };
  
  // Form handlers
  const openPermissaoForm = (permissao?: Permissao) => {
    setCurrentPermissao(permissao || null);
    setIsPermissaoFormOpen(true);
  };
  
  const openFuncaoPermissaoForm = (funcaoPermissao?: FuncaoPermissao) => {
    setCurrentFuncaoPermissao(funcaoPermissao || null);
    setIsFuncaoFormOpen(true);
  };
  
  const confirmDeletePermissao = (permissao: Permissao) => {
    setCurrentPermissao(permissao);
    setIsDeletePermissaoOpen(true);
  };
  
  const confirmDeleteFuncaoPermissao = (funcaoPermissao: FuncaoPermissao) => {
    setCurrentFuncaoPermissao(funcaoPermissao);
    setIsDeleteFuncaoPermissaoOpen(true);
  };
  
  const handleDeletePermissao = () => {
    if (currentPermissao?.id) {
      deletePermissaoMutation.mutate(currentPermissao.id);
    }
  };
  
  const handleDeleteFuncaoPermissao = () => {
    if (currentFuncaoPermissao?.id) {
      deleteFuncaoPermissaoMutation.mutate(currentFuncaoPermissao.id);
    }
  };
  
  const handleSavePermissao = (data: PermissaoFormData) => {
    if (currentPermissao?.id) {
      updatePermissaoMutation.mutate({ id: currentPermissao.id, data });
    } else {
      createPermissaoMutation.mutate(data);
    }
  };
  
  const handleSaveFuncaoPermissao = (data: FuncaoPermissaoFormData) => {
    if (currentFuncaoPermissao?.id) {
      updateFuncaoPermissaoMutation.mutate({ id: currentFuncaoPermissao.id, data });
    } else {
      createFuncaoPermissaoMutation.mutate(data);
    }
  };
  
  const isSubmitting = 
    createPermissaoMutation.isPending || 
    updatePermissaoMutation.isPending ||
    createFuncaoPermissaoMutation.isPending ||
    updateFuncaoPermissaoMutation.isPending;
    
  const isDeleting = 
    deletePermissaoMutation.isPending || 
    deleteFuncaoPermissaoMutation.isPending;
  
  return {
    // Estados
    isPermissaoFormOpen,
    isFuncaoFormOpen,
    isDeletePermissaoOpen,
    isDeleteFuncaoPermissaoOpen,
    currentPermissao,
    currentFuncaoPermissao,
    permissaoFilter,
    funcaoPermissaoFilter,
    isPermissaoLoading,
    isFuncaoPermissaoLoading,
    permissoes,
    funcoesPermissao,
    allPermissoes,
    isSubmitting,
    isDeleting,
    
    // Ações
    setIsPermissaoFormOpen,
    setIsFuncaoFormOpen,
    setIsDeletePermissaoOpen,
    setIsDeleteFuncaoPermissaoOpen,
    handlePermissaoFilterChange,
    handleFuncaoPermissaoFilterChange,
    resetPermissaoFilters,
    resetFuncaoPermissaoFilters,
    openPermissaoForm,
    openFuncaoPermissaoForm,
    confirmDeletePermissao,
    confirmDeleteFuncaoPermissao,
    handleDeletePermissao,
    handleDeleteFuncaoPermissao,
    handleSavePermissao,
    handleSaveFuncaoPermissao,
    refetchPermissoes,
    refetchFuncoesPermissao
  };
};
