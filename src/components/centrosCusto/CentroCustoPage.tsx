
import React from "react";
import { toast } from "sonner";

import { useCentroCustoActions } from "@/hooks/useCentroCustoActions";
import { usePermission } from "@/hooks/usePermission";
import CentroCustoFormModal from "./CentroCustoFormModal";
import CentroCustoDetailsModal from "./CentroCustoDetailsModal";
import ImportCentrosCustoModal from "./ImportCentrosCustoModal";
import CentroCustoFilters from "./CentroCustoFilters";
import CentroCustoTable from "./CentroCustoTable";
import DeleteCentroCustoDialog from "./DeleteCentroCustoDialog";
import CentroCustoHeaderActions from "./CentroCustoHeaderActions";
import { useIsMobile, useIsSmallScreen } from "@/hooks/use-mobile";
import { CentroCusto } from "@/types/centroCusto";

const DENIED_MSG = "Você não tem permissão para executar esta ação.";

const CentroCustoPage: React.FC = () => {
  const {
    filters,
    currentCentroCusto,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingCentroCusto,
    isDeleting,
    centrosCusto,
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
  } = useCentroCustoActions();

  const isMobile = useIsMobile();
  const isSmallScreen = useIsSmallScreen();

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_centros_custo_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_centros_custo_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_centros_custo_view', 'excluir');

  const handleOpenFormModal = (cc?: CentroCusto) => {
    if (cc && !canEdit) { toast.error(DENIED_MSG); return; }
    if (!cc && !canCreate) { toast.error(DENIED_MSG); return; }
    openFormModal(cc);
  };
  const handleOpenImport = () => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    setIsImportModalOpen(true);
  };
  const handleConfirmDelete = (cc: CentroCusto) => {
    if (!canDelete) { toast.error(DENIED_MSG); return; }
    confirmDelete(cc);
  };

  return (
    <div className={`space-y-2 ${isSmallScreen ? 'space-y-2' : isMobile ? 'space-y-3' : 'sm:space-y-6'}`}>
      <div className="flex justify-end">
        <CentroCustoHeaderActions
          onNewCentroCusto={() => handleOpenFormModal()}
          onExport={exportToExcel}
          onImport={handleOpenImport}
          canCreate={canCreate}
        />
      </div>

      <CentroCustoFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />

      <CentroCustoTable
        centrosCusto={centrosCusto}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleOpenFormModal}
        onView={openDetailsModal}
        onDelete={handleConfirmDelete}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <CentroCustoFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => refetch()}
        centroCusto={currentCentroCusto || undefined}
      />

      <CentroCustoDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        centroCusto={currentCentroCusto}
      />

      <ImportCentrosCustoModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <DeleteCentroCustoDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        centroCusto={deletingCentroCusto}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default CentroCustoPage;
