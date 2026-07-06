
import React, { useState } from "react";
import { toast } from "sonner";

import { usePermission } from "@/hooks/usePermission";
import { useEquipeActions } from "@/hooks/useEquipeActions";
import EquipeFormModal from "./EquipeFormModal";
import EquipeDetailsModal from "./EquipeDetailsModal";
import ImportEquipesModal from "./ImportEquipesModal";
import TransferMembersModal from "./TransferMembersModal";
import EquipeFilters from "./EquipeFilters";
import EquipeTable from "./EquipeTable";
import DeleteEquipeDialog from "./DeleteEquipeDialog";
import EquipeHeaderActions from "./EquipeHeaderActions";

const DENIED_MSG = "Você não tem permissão para executar esta ação.";

const EquipePage: React.FC = () => {
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedEquipeForTransfer, setSelectedEquipeForTransfer] = useState(null);

  const {
    // Estado
    filters,
    currentEquipe,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingEquipe,
    isDeleting,
    
    // Dados
    equipes,
    isLoading,
    isError,
    encarregados,
    apontadores,
    allFuncionarios,
    
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
  } = useEquipeActions();

  // Logging para debug
  console.log('🎯 [EquipePage] Estado atual:', {
    isLoading,
    isError,
    totalEquipes: equipes?.length || 0,
    filters,
    temEquipes: !!equipes,
    primeiraEquipe: equipes?.[0] || null
  });

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_equipes_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_equipes_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_equipes_view', 'excluir');

  const handleOpenFormModal = (equipe?: any) => {
    if (equipe && !canEdit) { toast.error(DENIED_MSG); return; }
    if (!equipe && !canCreate) { toast.error(DENIED_MSG); return; }
    openFormModal(equipe);
  };

  const handleOpenImport = () => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    setIsImportModalOpen(true);
  };

  const handleConfirmDelete = (equipe: any) => {
    if (!canDelete) { toast.error(DENIED_MSG); return; }
    confirmDelete(equipe);
  };

  const handleOpenTransferModal = (equipe) => {
    if (!canEdit) { toast.error(DENIED_MSG); return; }
    setSelectedEquipeForTransfer(equipe);
    setTransferModalOpen(true);
  };

  const handleCloseTransferModal = () => {
    setTransferModalOpen(false);
    setSelectedEquipeForTransfer(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <EquipeHeaderActions
          onNewEquipe={() => handleOpenFormModal()}
          onExport={() => exportToExcel(equipes)}
          onImport={handleOpenImport}
          canCreate={canCreate}
        />
      </div>
      
      <EquipeFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
        encarregados={encarregados}
        apontadores={apontadores}
      />
      
      <EquipeTable 
        equipes={equipes}
        isLoading={isLoading}
        isError={isError}
        onEdit={handleOpenFormModal}
        onView={openDetailsModal}
        onDelete={handleConfirmDelete}
        onTransfer={handleOpenTransferModal}
        canEdit={canEdit}
        canDelete={canDelete}
      />
      
      <EquipeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => refetch()}
        equipe={currentEquipe || undefined}
        encarregados={encarregados}
        apontadores={apontadores}
      />
      
      <EquipeDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        equipe={currentEquipe}
      />
      
      <ImportEquipesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {selectedEquipeForTransfer && (
        <TransferMembersModal
          isOpen={transferModalOpen}
          onClose={handleCloseTransferModal}
          sourceEquipe={selectedEquipeForTransfer}
          allEquipes={equipes}
        />
      )}

      
      <DeleteEquipeDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        equipe={deletingEquipe}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default EquipePage;
