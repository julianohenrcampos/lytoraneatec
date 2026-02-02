import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePermissionCacheInvalidation } from "@/hooks/usePermissionCacheInvalidation";
import { validateFunctionAssignment, cleanFunctionArray } from "@/utils/permissionValidation";
import { safeProfilesQuery } from "@/hooks/useSimpleTypeWorkaround";
import { userHasAnyPermission } from "@/utils/hybridPermissions";
import { useProfileSecurity } from "@/hooks/useProfileSecurity";
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
  
  // Hook de segurança para filtro departamental
  const { 
    hasGlobalAccess, 
    shouldFilterByDepartment, 
    departamentoId, 
    departamentoNome,
    isLoading: isSecurityLoading 
  } = useProfileSecurity();
  
  // Form states
  const [isPermissaoFormOpen, setIsPermissaoFormOpen] = useState(false);
  const [isFuncaoFormOpen, setIsFuncaoFormOpen] = useState(false);
  const [isDeletePermissaoOpen, setIsDeletePermissaoOpen] = useState(false);
  const [isDeleteFuncaoPermissaoOpen, setIsDeleteFuncaoPermissaoOpen] = useState(false);
  const [isAssignPermissionOpen, setIsAssignPermissionOpen] = useState(false);
  const [isUserDetailsOpen, setIsUserDetailsOpen] = useState(false);
  const [isRemoveAllPermissionsOpen, setIsRemoveAllPermissionsOpen] = useState(false);
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

  // Query para buscar funções únicas usando sistema híbrido
  const { data: availableFunctionsFromDB } = useQuery({
    queryKey: ['availableFunctions'],
    queryFn: async () => {
      console.log('🔍 Buscando todas as funções disponíveis...');
      
      try {
        // Buscar funções do campo funcoes (array) - safe fallback
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('funcao_sistema')
          .not('funcao_sistema', 'is', null);
        
        // Buscar funções da tabela bd_funcoes_permissao
        const { data: funcoesData, error: funcoesError } = await supabase
          .from('bd_funcoes_permissao')
          .select('nome_funcao');
        
        if (profilesError && funcoesError) {
          console.error('❌ Erro ao buscar funções:', { profilesError, funcoesError });
          throw profilesError || funcoesError;
        }
        
        const allFunctions = new Set<string>();
        
        // Adicionar funções do funcao_sistema
        profilesData?.forEach(profile => {
          if (profile.funcao_sistema && profile.funcao_sistema.trim() !== '') {
            allFunctions.add(profile.funcao_sistema);
          }
        });
        
        // Adicionar funções da tabela bd_funcoes_permissao
        funcoesData?.forEach(funcao => {
          if (funcao.nome_funcao && funcao.nome_funcao.trim() !== '') {
            allFunctions.add(funcao.nome_funcao);
          }
        });
        
        const finalFunctions = Array.from(allFunctions).sort();
        console.log('✅ Funções disponíveis encontradas:', finalFunctions);
        
        return finalFunctions;
      } catch (error) {
        console.error('❌ Erro ao buscar funções:', error);
        // Retornar funções padrão em caso de erro
        return ['SuperAdm', 'Administrador', 'Operador', 'Visualizador', 'Encarregado', 'Apontador', 'AdmRH', 'Engenheiro Civil', 'AdmLogistica', 'AdmEquipamentos'];
      }
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
        // Use safe query to avoid column errors
        const { data: users, error } = await safeProfilesQuery(supabase);
        
        if (error) {
          console.error('💥 ERRO na query híbrida:', error);
          throw error;
        }
        
        console.log('📊 DADOS HÍBRIDOS:');
        console.log(`📝 Array length: ${users?.length || 0}`);
        
        // Log detalhado dos usuários
        console.log('👥 ==== TODOS OS USUÁRIOS ENCONTRADOS ====');
        users?.forEach((user, index) => {
          console.log(`👤 ${index + 1}/${users.length}:`, {
            id: user.id?.substring(0, 8) + '...',
            nome: user.nome_completo || 'SEM NOME',
            funcao_sistema: user.funcao_sistema || 'SEM FUNCAO_SISTEMA',
            created_at: user.created_at
          });
        });
        
        console.log('✅ LISTAGEM HÍBRIDA - RETORNANDO:', users?.length || 0, 'usuários');
        return users as ProfileType[] || [];
        
      } catch (err) {
        console.error('🔥 ERRO na busca híbrida:', err);
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

  // Processar filtros nos dados retornados - incluindo filtro departamental
  const profiles = React.useMemo(() => {
    console.log('🔄 ====== PROCESSANDO FILTROS ======');
    console.log('📋 Filtros ativos:', profileFilter);
    console.log('📊 Total de usuários disponíveis:', allProfiles?.length || 0);
    console.log('🔐 Filtro departamental:', { shouldFilterByDepartment, departamentoId, departamentoNome });
    
    if (!allProfiles || allProfiles.length === 0) {
      console.log('⚠️ Nenhum dado disponível para filtrar');
      return [];
    }
    
    let filteredData = [...allProfiles];
    
    // NOVO: Aplicar filtro departamental para admins não-globais
    if (shouldFilterByDepartment && departamentoId) {
      const beforeFilter = filteredData.length;
      filteredData = filteredData.filter(profile => {
        // Verificar se o perfil pertence ao mesmo departamento
        const profileDeptId = profile.bd_funcionarios?.departamento_id;
        return profileDeptId === departamentoId;
      });
      console.log(`🏢 Filtro departamental (${departamentoNome}): ${beforeFilter} → ${filteredData.length} usuários`);
    }
    
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

    // Aplicar filtro de status - usando sistema híbrido (mesma lógica do badge)
    if (profileFilter.status && profileFilter.status !== '' && profileFilter.status !== 'todos') {
      const beforeFilter = filteredData.length;
      
      if (profileFilter.status === 'sem_permissao') {
        filteredData = filteredData.filter(profile => {
          // Usa mesma lógica do badge - sistema híbrido
          return !userHasAnyPermission(profile);
        });
      } else if (profileFilter.status === 'com_permissao') {
        filteredData = filteredData.filter(profile => {
          // Usa mesma lógica do badge - sistema híbrido
          return userHasAnyPermission(profile);
        });
      }
      
      console.log(`🎯 Filtro status "${profileFilter.status}": ${beforeFilter} → ${filteredData.length} usuários`);
    }

    console.log(`📊 ====== RESULTADO FINAL ======`);
    console.log(`📈 Total para exibição: ${filteredData.length} usuários`);

    return filteredData;
  }, [allProfiles, profileFilter, shouldFilterByDepartment, departamentoId, departamentoNome]);

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

  // Mutation para atribuir permissões - CORRIGIDA para usar funcoes[]
  const assignPermissionMutation = useMutation({
    mutationFn: async ({ profileId, funcaoString }: { profileId: string; funcaoString: string }) => {
      console.log('🔄 Atribuindo permissão:', { profileId, funcaoString });
      
      // Verificar se a função existe na tabela bd_funcoes_permissao
      const { data: funcaoExists, error: funcaoError } = await supabase
        .from('bd_funcoes_permissao')
        .select('id, nome_funcao')
        .eq('nome_funcao', funcaoString)
        .single();
      
      if (funcaoError || !funcaoExists) {
        console.warn('⚠️ Função não encontrada na tabela bd_funcoes_permissao:', funcaoString);
        // Continuar com a atribuição mesmo que não esteja na tabela de funções
      } else {
        console.log('✅ Função válida encontrada:', funcaoExists);
      }
      
      // Buscar funcoes[] atual do usuário
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('funcoes')
        .eq('id', profileId)
        .single();
      
      if (fetchError) {
        console.error('❌ Erro ao buscar perfil:', fetchError);
        throw fetchError;
      }
      
      console.log('📝 Funcoes atuais:', profile?.funcoes);
      
      // Adicionar nova função ao array funcoes (evitar duplicatas)
      const funcoesAtuais = profile?.funcoes || [];
      const novasFuncoes = [...funcoesAtuais];
      
      if (!novasFuncoes.includes(funcaoString)) {
        novasFuncoes.push(funcaoString);
        console.log('➕ Adicionando nova função:', funcaoString);
      } else {
        console.log('⚠️ Função já existe no array, não será duplicada');
      }
      
      // Atualizar apenas o campo funcoes[]
      const { error } = await supabase
        .from('profiles')
        .update({ funcoes: novasFuncoes })
        .eq('id', profileId);
      
      if (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        throw error;
      }
      
      console.log('✅ Permissão atribuída com sucesso - funcoes[]:', novasFuncoes);
      return { profileId, funcaoString, novasFuncoes };
    },
    onSuccess: (data) => {
      toast({
        title: "Permissão atribuída com sucesso",
        description: `A função "${data.funcaoString}" foi atribuída ao usuário.`,
        variant: "default",
      });
      setIsAssignPermissionOpen(false);
      setCurrentProfile(null);
      // Invalidar cache para atualizar dados
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['availableFunctions'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      console.error('❌ Erro ao atribuir permissão:', error);
      toast({
        title: "Erro ao atribuir permissão",
        description: error.message || "Não foi possível atribuir a permissão.",
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

  const openRemoveAllPermissions = (profile: ProfileType) => {
    setCurrentProfile(profile);
    setIsRemoveAllPermissionsOpen(true);
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
  isRemoveAllPermissionsOpen,
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
    setIsRemoveAllPermissionsOpen,
    handleProfileFilterChange,
    resetProfileFilters,
    openAssignPermission,
    openUserDetails,
    openRemoveAllPermissions,
    handleAssignPermission,
    refetchProfiles,
  };
};
