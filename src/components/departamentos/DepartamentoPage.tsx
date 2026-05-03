
import React from "react";
import { toast } from "sonner";

import { useDepartamentoActions } from "@/hooks/useDepartamentoActions";
import { usePermission } from "@/hooks/usePermission";
import DepartamentoFormModal from "./DepartamentoFormModal";
import DepartamentoDetailsModal from "./DepartamentoDetailsModal";
import ImportDepartamentosModal from "./ImportDepartamentosModal";
import DepartamentoFilters from "./DepartamentoFilters";
import DepartamentoTable from "./DepartamentoTable";
import DeleteDepartamentoDialog from "./DeleteDepartamentoDialog";
import DepartamentoHeaderActions from "./DepartamentoHeaderActions";
import { Departamento } from "@/types/departamento";

const DENIED_MSG = "Você não tem permissão para executar esta ação.";

const DepartamentoPage: React.FC = () => {
  const {
    filters,
    currentDepartamento,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingDepartamento,
    isDeleting,
    departamentos,
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
  } = useDepartamentoActions();

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_departamentos_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_departamentos_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_departamentos_view', 'excluir');

  const handleOpenFormModal = (d?: Departamento) => {
    if (d && !canEdit) { toast.error(DENIED_MSG); return; }
    if (!d && !canCreate) { toast.error(DENIED_MSG); return; }
    openFormModal(d);
  };
  const handleOpenImport = () => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    setIsImportModalOpen(true);
  };
  const handleConfirmDelete = (d: Departamento) => {
    if (!canDelete) { toast.error(DENIED_MSG); return; }
    confirmDelete(d);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DepartamentoHeaderActions
          onNewDepartamento={() => handleOpenFormModal()}
          onExport={exportToExcel}
          onImport={handleOpenImport}
          canCreate={canCreate}
        />
      </div>

      <DepartamentoFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      <DepartamentoTable
        departamentos={departamentos}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleOpenFormModal}
        onView={openDetailsModal}
        onDelete={handleConfirmDelete}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <DepartamentoFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => refetch()}
        departamento={currentDepartamento || undefined}
      />

      <DepartamentoDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        departamento={currentDepartamento}
      />

      <ImportDepartamentosModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <DeleteDepartamentoDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        departamento={deletingDepartamento}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default DepartamentoPage;
