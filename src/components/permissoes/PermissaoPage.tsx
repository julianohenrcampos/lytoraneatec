import React, { useState } from "react";
import { UserPlus, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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

import DeletePermissaoDialog from "./DeletePermissaoDialog";
import DeleteFuncaoPermissaoDialog from "./DeleteFuncaoPermissaoDialog";
import RemoveAllPermissionsDialog from "./RemoveAllPermissionsDialog";
import DeleteUserDialog from "./DeleteUserDialog";
import UserOverridesTab from "./UserOverridesTab";
import CreateGestorModal from "./CreateGestorModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ActionGuard from "./ActionGuard";
import { useVincularFuncionario } from "@/hooks/useVincularFuncionario";
import { useRemoverPermissoes } from "@/hooks/useRemoverPermissoes";
import { useExcluirUsuario } from "@/hooks/useExcluirUsuario";
import { usePermission } from "@/hooks/usePermission";
import { getCanonicalRoleNames } from "@/utils/adminPermissionProfile";

const PermissaoPage: React.FC = () => {
  const { userId, isSuperAdmin } = usePermission();
  
  const [isCreateGestorOpen, setIsCreateGestorOpen] = useState(false);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [unlinkingProfileId, setUnlinkingProfileId] = useState<string | null>(null);

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
  } = usePermissao();

  const { removerTodasFuncoes, isRemoving } = useRemoverPermissoes();

  const {
    isDeleting: isDeletingUser,
    isDeleteDialogOpen,
    userToDelete,
    openDeleteDialog,
    closeDeleteDialog,
    excluirUsuario,
  } = useExcluirUsuario(refetchProfiles);

  const handleRemoveAllPermissions = async () => {
    if (!currentProfile) return;
    
    const adminFunctions = getCanonicalRoleNames(currentProfile as any);
    const result = await removerTodasFuncoes(
      currentProfile.id,
      currentProfile.email || '',
      adminFunctions
    );
    
    if (result.success) {
      refetchProfiles();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PermissaoHeaderActions 
          onNewPermissao={() => openPermissaoForm()}
          onNewFuncaoPermissao={() => openFuncaoPermissaoForm()}
        />
      </div>

      {isSuperAdmin && (
        <div className="p-4 rounded-lg border bg-muted/30 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Como gerenciar permissões (SuperAdm)</p>
            <ol className="list-decimal ml-4 text-muted-foreground space-y-0.5">
              <li>Aba <strong>"Permissões"</strong> → <em>Nova Permissão</em> → preencha código, nome e rota</li>
              <li>Aba <strong>"Funções"</strong> → edite a função → marque ações (Ver/Criar/Editar/Excluir/Aprovar) por permissão</li>
              <li>Aba <strong>"Usuários"</strong> → atribua a função ao usuário ou crie overrides individuais nos detalhes</li>
            </ol>
          </div>
        </div>
      )}

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
          <TabsTrigger value="roles">Funções e Permissões</TabsTrigger>
          <TabsTrigger value="users">Usuários Cadastrados</TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="overrides">Overrides Individuais</TabsTrigger>
          )}
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
          {isSuperAdmin && (
            <div className="flex justify-end">
              <ActionGuard permission="admin_permissoes_view" action="criar">
                <Button onClick={() => setIsCreateGestorOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Novo Gestor
                </Button>
              </ActionGuard>
            </div>
          )}
          
          <UserProfilesTable 
            profiles={profiles || []}
            isLoading={isProfilesLoading}
            onAssignPermission={openAssignPermission}
            onEditPermission={openAssignPermission}
            onViewDetails={openUserDetails}
            onLinkFuncionario={openLinkModal}
            onUnlinkFuncionario={(profileId) => {
              setUnlinkingProfileId(profileId);
              setIsUnlinkDialogOpen(true);
            }}
            onRemoveAllPermissions={openRemoveAllPermissions}
            onDeleteUser={openDeleteDialog}
            currentUserId={userId || undefined}
            isSuperAdmin={isSuperAdmin}
            filters={profileFilter}
            onFilterChange={handleProfileFilterChange}
            onResetFilters={resetProfileFilters}
          />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="overrides" className="space-y-4">
            <UserOverridesTab />
          </TabsContent>
        )}
      </Tabs>
      
      {/* Modais */}
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
        permissaoNome={currentPermissao?.codigo}
        isDeleting={isDeleting}
      />
      
      <DeleteFuncaoPermissaoDialog
        isOpen={isDeleteFuncaoPermissaoOpen}
        onClose={() => setIsDeleteFuncaoPermissaoOpen(false)}
        onConfirm={handleDeleteFuncaoPermissao}
        funcaoPermissaoId={currentFuncaoPermissao?.id}
        funcaoPermissaoNome={currentFuncaoPermissao?.nome}
        isDeleting={isDeleting}
      />

      <DeleteUserDialog
        isOpen={isDeleteDialogOpen}
        onClose={closeDeleteDialog}
        profile={userToDelete}
        onConfirm={excluirUsuario}
        isDeleting={isDeletingUser}
      />

      <CreateGestorModal
        isOpen={isCreateGestorOpen}
        onClose={() => setIsCreateGestorOpen(false)}
        onSuccess={refetchProfiles}
      />

      <ConfirmDialog
        isOpen={isUnlinkDialogOpen}
        onClose={() => {
          setIsUnlinkDialogOpen(false);
          setUnlinkingProfileId(null);
        }}
        onConfirm={async () => {
          if (unlinkingProfileId) {
            await desvincularFuncionario(unlinkingProfileId);
            setIsUnlinkDialogOpen(false);
            setUnlinkingProfileId(null);
          }
        }}
        title="Desvincular Funcionário"
        description="⚠️ Este usuário passará a ter acesso global a todos os dados. Tem certeza que deseja desvincular?"
        confirmText="Desvincular"
        variant="warning"
        isLoading={isDesvinculando}
      />
    </div>
  );
};

export default PermissaoPage;
