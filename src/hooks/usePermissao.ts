import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePermissionCacheInvalidation } from "@/hooks/usePermissionCacheInvalidation";
import { 
  Permissao, 
  PermissaoFilter, 
  FuncaoPermissao, 
  FuncaoPermissaoFilter, 
  PermissaoFormData, 
  FuncaoPermissaoFormData,
  ProfileType 
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
import { supabase } from "@/integrations/supabase/client";

export const usePermissao = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidatePermissionCache, refetchUserPermissions } = usePermissionCacheInvalidation();
  
  // Form states
  const [isPermissaoFormOpen, setIsPermissaoFormOpen] = useState(false);
  const [isFuncaoFormOpen, setIsFuncaoFormOpen] = useState(false);
  const [isDeletePermissaoOpen, setIsDeletePermissaoOpen] = useState(false);
  const [isDeleteFuncaoPermissaoOpen, setIsDeleteFuncaoPermissaoOpen] = useState(false);
  const [isAssignPermissionOpen, setIsAssignPermissionOpen] = useState(false);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [currentPermissao, setCurrentPermissao] = useState<Permissao | null>(null);
  const [currentFuncaoPermissao, setCurrentFuncaoPermissao] = useState<FuncaoPermissao | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileType | null>(null);
  
  // Filter states
  const [permissaoFilter, setPermissaoFilter] = useState<PermissaoFilter>({});
  const [funcaoPermissaoFilter, setFuncaoPermissaoFilter] = useState<FuncaoPermissaoFilter>({});
  const [profileFilter, setProfileFilter] = useState<{ nome?: string; status?: string }>({});
  
  // Queries existentes
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

  // Query para buscar funções únicas
  const { data: availableFunctionsFromDB } = useQuery({
    queryKey: ['availableFunctions'],
    queryFn: async () => {
      console.log('🔍 Buscando todas as funções disponíveis...');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('funcoes')
        .not('funcoes', 'is', null);
      
      if (error) {
        console.error('❌ Erro ao buscar funções:', error);
        throw error;
      }
      
      const allFunctions = new Set<string>();
      data?.forEach(profile => {
        if (profile.funcoes && Array.isArray(profile.funcoes)) {
          profile.funcoes.forEach(funcao => {
            if (funcao && funcao.trim() !== '') {
              allFunctions.add(funcao);
            }
          });
        }
      });
      
      const defaultFunctions = [
        'SuperAdm',
        'Administrador', 
        'Operador',
        'Visualizador',
        'Encarregado',
        'Apontador',
        'AdmRH',
        'Engenheiro Civil',
        'AdmLogistica',
        'AdmEquipamentos'
      ];
      
      defaultFunctions.forEach(func => allFunctions.add(func));
      
      const finalFunctions = Array.from(allFunctions).sort();
      console.log('✅ Funções disponíveis encontradas:', finalFunctions);
      
      return finalFunctions;
    }
  });

  // Query CORRIGIDA - Agora com as políticas RLS adequadas
  const {
    data: allProfiles,
    isLoading: isProfilesLoading,
    refetch: refetchProfiles,
    error: profilesError
  } = useQuery({
    queryKey: ['all-profiles-corrected'],
    queryFn: async () => {
      console.log('🚀 ====== BUSCA CORRIGIDA COM POLÍTICAS RLS ======');
      console.log('📅 Timestamp:', new Date().toISOString());
      
      try {
        // Query otimizada que funciona com as novas políticas RLS
        const { data: users, error, count } = await supabase
          .from('profiles')
          .select(`
            id,
            email,
            nome_completo,
            imagem_url,
            funcoes,
            created_at
          `, { count: 'exact' })
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('💥 ERRO na query corrigida:', error);
          throw error;
        }
        
        console.log('📊 DADOS CORRIGIDOS:');
        console.log(`📈 Total de usuários encontrados: ${count}`);
        console.log(`📝 Array length: ${users?.length || 0}`);
        
        // Log detalhado dos usuários
        console.log('👥 ==== TODOS OS USUÁRIOS ENCONTRADOS ====');
        users?.forEach((user, index) => {
          console.log(`👤 ${index + 1}/${users.length}:`, {
            id: user.id?.substring(0, 8) + '...',
            nome: user.nome_completo || 'SEM NOME',
            email: user.email || 'SEM EMAIL',
            funcoes: user.funcoes || 'SEM FUNCOES',
            created_at: user.created_at
          });
        });
        
        console.log('✅ LISTAGEM CORRIGIDA - RETORNANDO:', users?.length || 0, 'usuários');
        return users as ProfileType[] || [];
        
      } catch (err) {
        console.error('🔥 ERRO na busca corrigida:', err);
        throw err;
      }
    },
    staleTime: 30000, // Cache por 30 segundos
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      console.log(`🔄 Tentativa ${failureCount + 1} de busca de usuários`);
      return failureCount < 2;
    }
  });

  // Processar filtros nos dados retornados
  const profiles = React.useMemo(() => {
    console.log('🔄 ====== PROCESSANDO FILTROS ======');
    console.log('📋 Filtros ativos:', profileFilter);
    console.log('📊 Total de usuários disponíveis:', allProfiles?.length || 0);
    
    if (!allProfiles || allProfiles.length === 0) {
      console.log('⚠️ Nenhum dado disponível para filtrar');
      return [];
    }
    
    let filteredData = [...allProfiles];
    
    // Aplicar filtro de nome
    if (profileFilter.nome && profileFilter.nome.trim() !== '') {
      const nomeFilter = profileFilter.nome.toLowerCase();
      const beforeFilter = filteredData.length;
      filteredData = filteredData.filter(profile => {
        const nome = (profile.nome_completo || '').toLowerCase();
        const email = (profile.email || '').toLowerCase();
        return nome.includes(nomeFilter) || email.includes(nomeFilter);
      });
      console.log(`🔍 Filtro nome "${profileFilter.nome}": ${beforeFilter} → ${filteredData.length} usuários`);
    }

    // Aplicar filtro de status
    if (profileFilter.status && profileFilter.status !== '' && profileFilter.status !== 'todos') {
      const beforeFilter = filteredData.length;
      
      if (profileFilter.status === 'sem_permissao') {
        filteredData = filteredData.filter(profile => {
          const funcoes = profile.funcoes || [];
          const temApenasUser = funcoes.length === 0 || 
                               funcoes.every(f => !f || f.trim() === '' || f === 'user');
          return temApenasUser;
        });
      } else if (profileFilter.status === 'com_permissao') {
        filteredData = filteredData.filter(profile => {
          const funcoes = profile.funcoes || [];
          const temPermissaoValida = funcoes.some(f => f && f.trim() !== '' && f !== 'user');
          return temPermissaoValida;
        });
      }
      
      console.log(`🎯 Filtro status "${profileFilter.status}": ${beforeFilter} → ${filteredData.length} usuários`);
    }

    console.log(`📊 ====== RESULTADO FINAL ======`);
    console.log(`📈 Total para exibição: ${filteredData.length} usuários`);

    return filteredData;
  }, [allProfiles, profileFilter]);

  // Lista de funções disponíveis
  const availableFunctions = availableFunctionsFromDB || [
    'SuperAdm',
    'Administrador',
    'Operador', 
    'Visualizador',
    'Encarregado',
    'Apontador'
  ];
  
  // Mutations com invalidação corrigida
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
      invalidatePermissionCache();
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
      invalidatePermissionCache();
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
      invalidatePermissionCache();
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
      invalidatePermissionCache();
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
      console.log('🔄 Função atualizada - invalidando cache de permissões');
      invalidatePermissionCache();
      refetchUserPermissions();
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
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir função",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation CORRIGIDA para atribuir permissões
  const assignPermissionMutation = useMutation({
    mutationFn: async ({ profileId, funcaoString }: { profileId: string; funcaoString: string }) => {
      console.log('🔄 Atribuindo permissão:', { profileId, funcaoString });
      
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('funcoes')
        .eq('id', profileId)
        .single();
      
      if (fetchError) {
        console.error('❌ Erro ao buscar perfil:', fetchError);
        throw fetchError;
      }
      
      const currentFuncoes = profile?.funcoes || ['user'];
      // Filtrar 'user' se estiver presente e adicionar nova função
      const filteredFuncoes = currentFuncoes.filter(f => f !== 'user');
      const newFuncoes = [...new Set([...filteredFuncoes, funcaoString])];
      
      console.log('📝 Atualizando funções:', { currentFuncoes, newFuncoes });
      
      const { error } = await supabase
        .from('profiles')
        .update({ funcoes: newFuncoes })
        .eq('id', profileId);
      
      if (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        throw error;
      }
      
      console.log('✅ Permissão atribuída com sucesso');
      return { profileId, funcaoString };
    },
    onSuccess: () => {
      toast({
        title: "Permissão atribuída com sucesso",
        variant: "default",
      });
      setIsAssignPermissionOpen(false);
      // Invalidar cache para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['availableFunctions'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atribuir permissão",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Filter handlers mantidos
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

  const handleProfileFilterChange = (name: string, value: any) => {
    console.log(`🔧 Alterando filtro ${name} para:`, value);
    setProfileFilter(prev => {
      const newFilter = {
        ...prev,
        [name]: value
      };
      console.log('🔧 Novos filtros de profile:', newFilter);
      return newFilter;
    });
  };
  
  const resetPermissaoFilters = () => {
    setPermissaoFilter({});
  };
  
  const resetFuncaoPermissaoFilters = () => {
    setFuncaoPermissaoFilter({});
  };

  const resetProfileFilters = () => {
    console.log('🔄 Resetando todos os filtros de profile');
    setProfileFilter({});
    queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
  };
  
  // Form handlers mantidos
  const openPermissaoForm = (permissao?: Permissao) => {
    setCurrentPermissao(permissao || null);
    setIsPermissaoFormOpen(true);
  };
  
  const openFuncaoPermissaoForm = (funcaoPermissao?: FuncaoPermissao) => {
    setCurrentFuncaoPermissao(funcaoPermissao || null);
    setIsFuncaoFormOpen(true);
  };

  const openAssignPermission = (profile: ProfileType) => {
    setCurrentProfile(profile);
    setIsAssignPermissionOpen(true);
  };

  const openUserDetails = (profile: ProfileType) => {
    setCurrentProfile(profile);
    setIsUserDetailsOpen(true);
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

  const handleAssignPermission = (profileId: string, funcaoString: string) => {
    assignPermissionMutation.mutate({ profileId, funcaoString });
  };
  
  const isSubmitting = 
    createPermissaoMutation.isPending || 
    updatePermissaoMutation.isPending ||
    createFuncaoPermissaoMutation.isPending ||
    updateFuncaoPermissaoMutation.isPending ||
    assignPermissionMutation.isPending;
    
  const isDeleting = 
    deletePermissaoMutation.isPending || 
    deleteFuncaoPermissaoMutation.isPending;
  
  return {
    // Estados existentes
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

    // Estados para usuários
    isAssignPermissionOpen,
    isUserDetailsOpen,
    currentProfile,
    profileFilter,
    profiles,
    isProfilesLoading,
    availableFunctions,
    profilesError,
    
    // Ações existentes mantidas
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
    refetchFuncoesPermissao,

    // Ações para usuários
    setIsAssignPermissionOpen,
    setIsUserDetailsOpen,
    handleProfileFilterChange,
    resetProfileFilters,
    openAssignPermission,
    openUserDetails,
    handleAssignPermission,
    refetchProfiles,
  };
};
