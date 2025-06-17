import React from "react";
import { UserCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissao } from "@/hooks/usePermissao";
import PermissaoHeaderActions from "./PermissaoHeaderActions";
import PermissaoTable from "./PermissaoTable";
import FuncaoPermissaoTable from "./FuncaoPermissaoTable";
import PermissaoFormModal from "./PermissaoFormModal";
import FuncaoPermissaoFormModal from "./FuncaoPermissaoFormModal";
import DeletePermissaoDialog from "./DeletePermissaoDialog";
import DeleteFuncaoPermissaoDialog from "./DeleteFuncaoPermissaoDialog";
import PermissionDebugPanel from "../debug/PermissionDebugPanel";

const PermissaoPage: React.FC = () => {
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
  } = usePermissao();

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
      </Tabs>

      {/* ⭐ NOVO: Debug Panel */}
      <PermissionDebugPanel />
      
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
