
import React from "react";

import { useCentroCustoActions } from "@/hooks/useCentroCustoActions";
import CentroCustoFormModal from "./CentroCustoFormModal";
import CentroCustoDetailsModal from "./CentroCustoDetailsModal";
import ImportCentrosCustoModal from "./ImportCentrosCustoModal";
import CentroCustoFilters from "./CentroCustoFilters";
import CentroCustoTable from "./CentroCustoTable";
import DeleteCentroCustoDialog from "./DeleteCentroCustoDialog";
import CentroCustoHeaderActions from "./CentroCustoHeaderActions";
import { useIsMobile, useIsSmallScreen } from "@/hooks/use-mobile";

const CentroCustoPage: React.FC = () => {
  const {
    // Estado
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
    
    // Ações
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
    exportToExcel
  } = useCentroCustoActions();

  const isMobile = useIsMobile();
  const isSmallScreen = useIsSmallScreen();

  return (
    <div className={`space-y-2 ${isSmallScreen ? 'space-y-2' : isMobile ? 'space-y-3' : 'sm:space-y-6'}`}>
      <div className="flex justify-end">
        <CentroCustoHeaderActions 
          onNewCentroCusto={() => openFormModal()}
          onExport={exportToExcel}
          onImport={() => setIsImportModalOpen(true)}
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
        onEdit={openFormModal}
        onView={openDetailsModal}
        onDelete={confirmDelete}
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
