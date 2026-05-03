
import React from "react";
import { toast } from "sonner";

import { useEmpresaActions } from "@/hooks/useEmpresaActions";
import { useEmpresaAdmin } from "@/hooks/useEmpresaAdmin";
import { usePermission } from "@/hooks/usePermission";
import EmpresaFormModal from "./EmpresaFormModal";
import EmpresaDetailsModal from "./EmpresaDetailsModal";
import ImportEmpresasModal from "./ImportEmpresasModal";
import EmpresaFilters from "./EmpresaFilters";
import EmpresaTable from "./EmpresaTable";
import DeleteEmpresaDialog from "./DeleteEmpresaDialog";
import EmpresaHeaderActions from "./EmpresaHeaderActions";
import { Empresa } from "@/types/empresa";

const DENIED_MSG = "Você não tem permissão para executar esta ação.";

const EmpresaPage: React.FC = () => {
  const { isAdmin } = useEmpresaAdmin(null);

  const {
    filters,
    currentEmpresa,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingEmpresa,
    isDeleting,
    empresas,
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
  } = useEmpresaActions();

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_empresas_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_empresas_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_empresas_view', 'excluir');

  const handleOpenFormModal = (e?: Empresa) => {
    if (e && !canEdit) { toast.error(DENIED_MSG); return; }
    if (!e && !canCreate) { toast.error(DENIED_MSG); return; }
    openFormModal(e);
  };
  const handleOpenImport = () => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    setIsImportModalOpen(true);
  };
  const handleConfirmDelete = (e: Empresa) => {
    if (!canDelete) { toast.error(DENIED_MSG); return; }
    confirmDelete(e);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <EmpresaHeaderActions
          onNewEmpresa={() => handleOpenFormModal()}
          onExport={exportToExcel}
          onImport={handleOpenImport}
          canCreate={canCreate}
        />
      </div>

      <EmpresaFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      <EmpresaTable
        empresas={empresas}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleOpenFormModal}
        onView={openDetailsModal}
        onDelete={handleConfirmDelete}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <EmpresaFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => refetch()}
        empresa={currentEmpresa}
      />

      <EmpresaDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        empresa={currentEmpresa}
      />

      <ImportEmpresasModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <DeleteEmpresaDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        empresa={deletingEmpresa}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default EmpresaPage;
