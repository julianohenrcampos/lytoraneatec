import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePermissionCacheInvalidation } from "@/hooks/usePermissionCacheInvalidation";
import { invalidateUsePermissionRuntimeCache } from "@/hooks/usePermission";
import { useProfileSecurity } from "@/hooks/useProfileSecurity";
import { ProfileType } from "@/types/permissao";
import {
  fetchPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  type RBACPermission,
  type RBACPermissionFormData,
  type RBACPermissionFilter,
} from "@/services/rbac/permissionsCRUD";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  type RBACRole,
  type RBACRoleFormData,
  type RBACRoleFilter,
} from "@/services/rbac/rolesCRUD";
import {
  assignUserRole,
  getRoleByName,
} from "@/services/rbac/userRolesCRUD";
import { fetchManageablePermissionProfiles } from "@/services/rbac/permissionAdminSecure";
import { supabase } from "@/integrations/supabase/client";
import { getCanonicalRoleNames, hasCanonicalPermissionProfile } from "@/utils/adminPermissionProfile";

export const usePermissao = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { invalidatePermissionCache, refetchUserPermissions } = usePermissionCacheInvalidation();
  
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
  const [currentPermissao, setCurrentPermissao] = useState<RBACPermission | null>(null);
  const [currentFuncaoPermissao, setCurrentFuncaoPermissao] = useState<RBACRole | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileType | null>(null);
  
  // Filter states
  const [permissaoFilter, setPermissaoFilter] = useState<RBACPermissionFilter>({});
  const [funcaoPermissaoFilter, setFuncaoPermissaoFilter] = useState<RBACRoleFilter>({});
  const [profileFilter, setProfileFilter] = useState<{ nome?: string; status?: string }>({});
  
  // === PERMISSIONS (bd_permissions) ===
  const {
    data: permissoes,
    isLoading: isPermissaoLoading,
    refetch: refetchPermissoes
  } = useQuery({
    queryKey: ['rbac-permissions', permissaoFilter],
    queryFn: () => fetchPermissions(permissaoFilter)
  });
  
  const {
    data: allPermissoes,
  } = useQuery({
    queryKey: ['rbac-all-permissions'],
    queryFn: () => fetchPermissions({})
  });

  // === ROLES (bd_roles + bd_role_permissions) ===
  const {
    data: funcoesPermissao,
    isLoading: isFuncaoPermissaoLoading,
    refetch: refetchFuncoesPermissao
  } = useQuery({
    queryKey: ['rbac-roles', funcaoPermissaoFilter],
    queryFn: () => fetchRoles(funcaoPermissaoFilter)
  });

  // === AVAILABLE ROLES for user assignment ===
  const { data: availableFunctionsFromDB } = useQuery({
    queryKey: ['rbac-available-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_roles')
        .select('nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []).map(r => r.nome);
    }
  });

  // === PROFILES ===
  const {
    data: allProfiles,
    isLoading: isProfilesLoading,
    refetch: refetchProfiles,
    error: profilesError
  } = useQuery({
    queryKey: ['all-profiles-corrected'],
    queryFn: fetchManageablePermissionProfiles,
    staleTime: 30000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: (failureCount) => failureCount < 2
  });

  // Process filters
  const profiles = React.useMemo(() => {
    if (!allProfiles || allProfiles.length === 0) return [];
    
    let filteredData = [...allProfiles];
    
    if (shouldFilterByDepartment && departamentoId) {
      filteredData = filteredData.filter(profile => profile.departamento_id === departamentoId);
    }
    
    if (profileFilter.nome && profileFilter.nome.trim() !== '') {
      const nomeFilter = profileFilter.nome.toLowerCase();
      filteredData = filteredData.filter(profile => {
        const nome = (profile.nome_completo || '').toLowerCase();
        const email = (profile.email || '').toLowerCase();
        return nome.includes(nomeFilter) || email.includes(nomeFilter);
      });
    }

    if (profileFilter.status && profileFilter.status !== '' && profileFilter.status !== 'todos') {
      if (profileFilter.status === 'sem_permissao') {
        filteredData = filteredData.filter(profile => !hasCanonicalPermissionProfile(profile));
      } else if (profileFilter.status === 'com_permissao') {
        filteredData = filteredData.filter(profile => hasCanonicalPermissionProfile(profile));
      }
    }

    return filteredData;
  }, [allProfiles, profileFilter, shouldFilterByDepartment, departamentoId, departamentoNome]);

  const availableFunctions = availableFunctionsFromDB || [];
  
  // === MUTATIONS ===
  
  // Permission mutations
  const createPermissaoMutation = useMutation({
    mutationFn: (data: RBACPermissionFormData) => createPermission(data),
    onSuccess: () => {
      toast({ title: "Permissão criada com sucesso." });
      setIsPermissaoFormOpen(false);
      setCurrentPermissao(null);
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-all-permissions'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      console.error("[PERMISSOES][MUTATION_ERROR][CREATE]", error);
      toast({
        title: "Erro ao criar permissão",
        description: error?.message || "Erro desconhecido.",
        variant: "destructive",
      });
      // NÃO fechar modal em erro
    }
  });
  
  const updatePermissaoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RBACPermissionFormData }) => updatePermission(id, data),
    onSuccess: () => {
      toast({ title: "Permissão atualizada com sucesso" });
      setIsPermissaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-all-permissions'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      console.error("[PERMISSOES][MUTATION_ERROR][UPDATE]", error);
      toast({ title: "Erro ao atualizar permissão", description: error.message, variant: "destructive" });
    }
  });
  
  const deletePermissaoMutation = useMutation({
    mutationFn: (id: string) => deletePermission(id),
    onSuccess: () => {
      toast({ title: "Permissão excluída com sucesso" });
      setIsDeletePermissaoOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-all-permissions'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir permissão", description: error.message, variant: "destructive" });
    }
  });
  
  // Role mutations
  const createFuncaoPermissaoMutation = useMutation({
    mutationFn: (data: RBACRoleFormData) => createRole(data),
    onSuccess: () => {
      toast({ title: "Função criada com sucesso" });
      setIsFuncaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-available-roles'] });
      invalidatePermissionCache();
      invalidateUsePermissionRuntimeCache();
      refetchUserPermissions();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar função", description: error.message, variant: "destructive" });
    }
  });
  
  const updateFuncaoPermissaoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RBACRoleFormData }) => updateRole(id, data),
    onSuccess: () => {
      toast({ title: "Função atualizada com sucesso" });
      setIsFuncaoFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-available-roles'] });
      invalidatePermissionCache();
      invalidateUsePermissionRuntimeCache();
      refetchUserPermissions();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar função", description: error.message, variant: "destructive" });
    }
  });
  
  const deleteFuncaoPermissaoMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      toast({ title: "Função excluída com sucesso" });
      setIsDeleteFuncaoPermissaoOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-available-roles'] });
      invalidatePermissionCache();
      invalidateUsePermissionRuntimeCache();
      refetchUserPermissions();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir função", description: error.message, variant: "destructive" });
    }
  });

  // Assign role mutation — uses bd_user_roles instead of profiles.funcoes
  const assignPermissionMutation = useMutation({
    mutationFn: async ({ profileId, funcaoString }: { profileId: string; funcaoString: string }) => {
      console.log('🔄 [RBAC] Atribuindo role:', { profileId, funcaoString });
      
      // Find or verify role exists
      const roleId = await getRoleByName(funcaoString);
      if (!roleId) {
        throw new Error(`Role "${funcaoString}" não encontrada em bd_roles`);
      }
      
      // Assign via secure RPC / bd_user_roles
      await assignUserRole(profileId, roleId);
      
      console.log('✅ [RBAC] Role atribuída com sucesso');
      return { profileId, funcaoString };
    },
    onSuccess: (data) => {
      toast({
        title: "Permissão atribuída com sucesso",
        description: `A função "${data.funcaoString}" foi atribuída ao usuário.`,
      });
      setIsAssignPermissionOpen(false);
      setCurrentProfile(null);
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['rbac-available-roles'] });
      invalidatePermissionCache();
    },
    onError: (error: any) => {
      console.error('❌ [RBAC] Erro ao atribuir permissão:', error);
      toast({
        title: "Erro ao atribuir permissão",
        description: error.message || "Não foi possível atribuir a permissão.",
        variant: "destructive",
      });
    }
  });
  
  // Filter handlers
  const handlePermissaoFilterChange = (name: string, value: any) => {
    setPermissaoFilter(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFuncaoPermissaoFilterChange = (name: string, value: any) => {
    setFuncaoPermissaoFilter(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileFilterChange = (name: string, value: any) => {
    setProfileFilter(prev => ({ ...prev, [name]: value }));
  };
  
  const resetPermissaoFilters = () => setPermissaoFilter({});
  const resetFuncaoPermissaoFilters = () => setFuncaoPermissaoFilter({});
  const resetProfileFilters = () => {
    setProfileFilter({});
    queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
  };
  
  // Form handlers
  const openPermissaoForm = (permissao?: RBACPermission) => {
    setCurrentPermissao(permissao || null);
    setIsPermissaoFormOpen(true);
  };
  
  const openFuncaoPermissaoForm = (funcaoPermissao?: RBACRole) => {
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
  
  const confirmDeletePermissao = (permissao: RBACPermission) => {
    setCurrentPermissao(permissao);
    setIsDeletePermissaoOpen(true);
  };
  
  const confirmDeleteFuncaoPermissao = (funcaoPermissao: RBACRole) => {
    setCurrentFuncaoPermissao(funcaoPermissao);
    setIsDeleteFuncaoPermissaoOpen(true);
  };
  
  const handleDeletePermissao = () => {
    if (currentPermissao?.id) deletePermissaoMutation.mutate(currentPermissao.id);
  };
  
  const handleDeleteFuncaoPermissao = () => {
    if (currentFuncaoPermissao?.id) deleteFuncaoPermissaoMutation.mutate(currentFuncaoPermissao.id);
  };
  
  const handleSavePermissao = async (data: RBACPermissionFormData) => {
    console.log("[PERMISSOES][HANDLE_SAVE]", data);
    try {
      if (currentPermissao?.id) {
        await updatePermissaoMutation.mutateAsync({ id: currentPermissao.id, data });
      } else {
        await createPermissaoMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("[PERMISSOES][HANDLE_SAVE_ERROR]", error);
      // Erro já tratado no onError da mutation (toast + modal aberto)
    }
  };
  
  const handleSaveFuncaoPermissao = (data: RBACRoleFormData) => {
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
    isAssignPermissionOpen,
    isUserDetailsOpen,
    isRemoveAllPermissionsOpen,
    currentProfile,
    profileFilter,
    profiles,
    isProfilesLoading,
    availableFunctions,
    profilesError,
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
