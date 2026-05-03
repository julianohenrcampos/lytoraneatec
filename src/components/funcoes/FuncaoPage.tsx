
import React from "react";
import { toast } from "sonner";

import { useFuncaoActions } from "@/hooks/useFuncaoActions";
import { usePermission } from "@/hooks/usePermission";
import FuncaoFormModal from "./FuncaoFormModal";
import FuncaoDetailsModal from "./FuncaoDetailsModal";
import ImportFuncoesModal from "./ImportFuncoesModal";
import FuncaoFilters from "./FuncaoFilters";
import FuncaoTable from "./FuncaoTable";
import DeleteFuncaoDialog from "./DeleteFuncaoDialog";
import FuncaoHeaderActions from "./FuncaoHeaderActions";
import { Funcao } from "@/types/funcao";

const DENIED_MSG = "Você não tem permissão para executar esta ação.";

const FuncaoPage: React.FC = () => {
  const {
    filters,
    currentFuncao,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingFuncao,
    isDeleting,
    funcoes,
    isLoading,
    isError,
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
  } = useFuncaoActions();

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_funcoes_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_funcoes_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_funcoes_view', 'excluir');

  const handleOpenFormModal = (f?: Funcao) => {
    if (f && !canEdit) { toast.error(DENIED_MSG); return; }
    if (!f && !canCreate) { toast.error(DENIED_MSG); return; }
    openFormModal(f);
  };
  const handleOpenImport = () => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    setIsImportModalOpen(true);
  };
  const handleConfirmDelete = (f: Funcao) => {
    if (!canDelete) { toast.error(DENIED_MSG); return; }
    confirmDelete(f);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FuncaoHeaderActions
          onNewFuncao={() => handleOpenFormModal()}
          onExport={exportToExcel}
          onImport={handleOpenImport}
          canCreate={canCreate}
        />
      </div>

      <FuncaoFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      <FuncaoTable
        funcoes={funcoes}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleOpenFormModal}
        onView={openDetailsModal}
        onDelete={handleConfirmDelete}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <FuncaoFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => refetch()}
        funcao={currentFuncao || undefined}
      />

      <FuncaoDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        funcao={currentFuncao}
      />

      <ImportFuncoesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <DeleteFuncaoDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        funcao={deletingFuncao}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default FuncaoPage;
