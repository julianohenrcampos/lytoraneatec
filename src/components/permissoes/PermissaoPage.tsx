
import React from "react";
import { UserCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissao } from "@/hooks/usePermissao";
import PermissaoHeaderActions from "./PermissaoHeaderActions";
import PermissaoTable from "./PermissaoTable";
import FuncaoPermissaoTable from "./FuncaoPermissaoTable";
import UserProfilesTable from "./UserProfilesTable";
import PermissaoFormModal from "./PermissaoFormModal";
import FuncaoPermissaoFormModal from "./FuncaoPermissaoFormModal";
import AssignPermissionModal from "./AssignPermissionModal";
import UserDetailsModal from "./UserDetailsModal";
import LinkFuncionarioModal from "./LinkFuncionarioModal";
import DepartamentoStatusCard from "./DepartamentoStatusCard";
import DeletePermissaoDialog from "./DeletePermissaoDialog";
import DeleteFuncaoPermissaoDialog from "./DeleteFuncaoPermissaoDialog";
import RemoveAllPermissionsDialog from "./RemoveAllPermissionsDialog";
import { useVincularFuncionario } from "@/hooks/useVincularFuncionario";
import { useRemoverPermissoes } from "@/hooks/useRemoverPermissoes";

const PermissaoPage: React.FC = () => {
  // Hook de vinculação
  const {
    isLinkModalOpen,
    selectedProfileId,
    openLinkModal,
    closeLinkModal,
    vincularFuncionario,
    desvincularFuncionario,
    isVinculando,
    isDesvinculando,
  } = useVincularFuncionario();

  const {
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
    
    // Novos estados para usuários
    isAssignPermissionOpen,
    isUserDetailsOpen,
    isRemoveAllPermissionsOpen,
    currentProfile,
    profileFilter,
    profiles,
    isProfilesLoading,
    availableFunctions, // Nova propriedade
    
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
    refetchFuncoesPermissao,

    // Novas ações para usuários
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
  } = usePermissao();

  const { removerTodasFuncoes, isRemoving } = useRemoverPermissoes();

  const handleRemoveAllPermissions = async () => {
    if (!currentProfile) return;
    
    const adminFunctions = currentProfile.funcoes?.filter(f => f !== 'user') || [];
    const result = await removerTodasFuncoes(
      currentProfile.id,
      currentProfile.email || '',
      adminFunctions
    );
    
    if (result.success) {
      refetchProfiles();
    }
  };

  // Buscar nome da função de permissão para exibir nos detalhes
  const getFuncaoPermissaoNome = (funcaoPermissaoId: string | null) => {
    if (!funcaoPermissaoId || !funcoesPermissao) return undefined;
    const funcao = funcoesPermissao.find(f => f.id === funcaoPermissaoId);
    return funcao?.nome_funcao;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Gestão de Permissões</h1>
        </div>
        
        <PermissaoHeaderActions 
          onNewPermissao={() => openPermissaoForm()}
          onNewFuncaoPermissao={() => openFuncaoPermissaoForm()}
        />
      </div>
      
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
          <TabsTrigger value="roles">Funções e Permissões</TabsTrigger>
          <TabsTrigger value="users">Usuários Cadastrados</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permissions" className="space-y-4">
          <PermissaoTable 
            permissoes={permissoes || []}
            isLoading={isPermissaoLoading}
            onEdit={openPermissaoForm}
            onDelete={confirmDeletePermissao}
            filters={permissaoFilter}
            onFilterChange={handlePermissaoFilterChange}
            onResetFilters={resetPermissaoFilters}
          />
        </TabsContent>
        
        <TabsContent value="roles" className="space-y-4">
          <FuncaoPermissaoTable 
            funcoesPermissao={funcoesPermissao || []}
            isLoading={isFuncaoPermissaoLoading}
            onEdit={openFuncaoPermissaoForm}
            onDelete={confirmDeleteFuncaoPermissao}
            filters={funcaoPermissaoFilter}
            onFilterChange={handleFuncaoPermissaoFilterChange}
            onResetFilters={resetFuncaoPermissaoFilters}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <DepartamentoStatusCard />
          
          <UserProfilesTable 
            profiles={profiles || []}
            isLoading={isProfilesLoading}
            onAssignPermission={openAssignPermission}
            onEditPermission={openAssignPermission}
            onViewDetails={openUserDetails}
            onLinkFuncionario={openLinkModal}
            onUnlinkFuncionario={(profileId) => {
              if (confirm('⚠️ Este usuário passará a ter acesso global a todos os dados. Confirma?')) {
                desvincularFuncionario(profileId);
              }
            }}
            onRemoveAllPermissions={openRemoveAllPermissions}
            filters={profileFilter}
            onFilterChange={handleProfileFilterChange}
            onResetFilters={resetProfileFilters}
          />
        </TabsContent>
      </Tabs>
      
      {/* Modais existentes */}
      <PermissaoFormModal
        isOpen={isPermissaoFormOpen}
        onClose={() => setIsPermissaoFormOpen(false)}
        permissao={currentPermissao}
        onSubmit={handleSavePermissao}
        isSubmitting={isSubmitting}
      />
      
      <FuncaoPermissaoFormModal
        isOpen={isFuncaoFormOpen}
        onClose={() => setIsFuncaoFormOpen(false)}
        funcaoPermissao={currentFuncaoPermissao}
        permissoes={allPermissoes || []}
        onSubmit={handleSaveFuncaoPermissao}
        isSubmitting={isSubmitting}
      />

      {/* Novos modais para usuários */}
      <AssignPermissionModal
        isOpen={isAssignPermissionOpen}
        onClose={() => setIsAssignPermissionOpen(false)}
        profile={currentProfile}
        availableFunctions={availableFunctions || []}
        onAssign={handleAssignPermission}
        isSubmitting={isSubmitting}
      />

      <UserDetailsModal
        isOpen={isUserDetailsOpen}
        onClose={() => setIsUserDetailsOpen(false)}
        profile={currentProfile}
      />

      {/* Modal de vinculação de funcionário */}
      <LinkFuncionarioModal
        isOpen={isLinkModalOpen}
        onClose={closeLinkModal}
        profileId={selectedProfileId}
        onLink={vincularFuncionario}
        isSubmitting={isVinculando}
      />

      <RemoveAllPermissionsDialog
        isOpen={isRemoveAllPermissionsOpen}
        onClose={() => setIsRemoveAllPermissionsOpen(false)}
        profile={currentProfile}
        onConfirm={handleRemoveAllPermissions}
        isRemoving={isRemoving}
      />
      
      <DeletePermissaoDialog
        isOpen={isDeletePermissaoOpen}
        onClose={() => setIsDeletePermissaoOpen(false)}
        onConfirm={handleDeletePermissao}
        permissaoId={currentPermissao?.id}
        permissaoNome={currentPermissao?.nome_permissao}
        isDeleting={isDeleting}
      />
      
      <DeleteFuncaoPermissaoDialog
        isOpen={isDeleteFuncaoPermissaoOpen}
        onClose={() => setIsDeleteFuncaoPermissaoOpen(false)}
        onConfirm={handleDeleteFuncaoPermissao}
        funcaoPermissaoId={currentFuncaoPermissao?.id}
        funcaoPermissaoNome={currentFuncaoPermissao?.nome_funcao}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default PermissaoPage;
