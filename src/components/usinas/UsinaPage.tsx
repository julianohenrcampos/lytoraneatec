
import React from "react";

import { useUsinaActions } from "@/hooks/useUsinaActions";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import UsinaFormModal from "./UsinaFormModal";
import UsinaDetailsModal from "./UsinaDetailsModal";
import ImportUsinasModal from "./ImportUsinasModal";
import UsinaFilters from "./UsinaFilters";
import UsinaTable from "./UsinaTable";
import DeleteUsinaDialog from "./DeleteUsinaDialog";
import UsinaHeaderActions from "./UsinaHeaderActions";
import { Usina } from "@/types/usina";

const UsinaPage: React.FC = () => {
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const { toast } = useToast();
  const canDeleteUsina =
    isSuperAdmin || hasActionPermission("gestao_maquinas_usinas_view", "excluir");
  const canExportUsina =
    isSuperAdmin || hasActionPermission("gestao_maquinas_usinas_view", "visualizar");
  const {
    // State
    filters,
    currentUsina,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingUsina,
    isDeleting,
    usinas,
    isLoading,
    isError,
    
    // Actions
    setIsFormModalOpen,
    setIsDetailsModalOpen,
    setIsImportModalOpen,
    setIsDeleteModalOpen,
    handleFilterChange,
    resetFilters,
    openFormModal,
    openDetailsModal,
    confirmDelete,
    handleDelete,
    refetch,
    exportToExcel,
    
    // Mutations
    createUsina,
    updateUsina,
    importUsinas
  } = useUsinaActions();

  // Função para garantir que o manipulador de save retorne Promise<void>
  const handleSave = async (id: string | undefined, data: Partial<Usina>): Promise<void> => {
    if (id) {
      await updateUsina(id, data);
      return;
    } else {
      await createUsina({
        nome_usina: data.nome_usina as string,
        endereco: data.endereco,
        producao_total: data.producao_total,
        telefone: data.telefone
      });
      return;
    }
  };



  // Garantir que importUsinas retorne Promise<void>
  const handleImport = async (usinas: any[]): Promise<void> => {
    await importUsinas(usinas);
    return;
  };

  const guardedDeleteUsina = async (): Promise<void> => {
    if (!canDeleteUsina) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    await handleDelete();
  };

  const guardedExportUsina = () => {
    if (!canExportUsina) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    exportToExcel();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <UsinaHeaderActions 
          onNewUsina={() => openFormModal()}
          onExport={guardedExportUsina}
          onImport={() => setIsImportModalOpen(true)}
          canExport={canExportUsina}
        />
      </div>
      
      <UsinaFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />
      
      <UsinaTable 
        usinas={usinas || []}
        isLoading={isLoading}
        isError={isError}
        onEdit={openFormModal}
        onView={openDetailsModal}
        onDelete={confirmDelete}
        canDelete={canDeleteUsina}
      />
      
      <UsinaFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => refetch()}
        usina={currentUsina || undefined}
        onSave={handleSave}
      />
      
      <UsinaDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        usina={currentUsina}
      />
      
      <ImportUsinasModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
        onImport={handleImport}
      />
      
      <DeleteUsinaDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        usina={deletingUsina}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={guardedDeleteUsina}
      />
    </div>
  );
};

export default UsinaPage;
