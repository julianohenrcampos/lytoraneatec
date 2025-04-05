
import React from "react";
import { Users } from "lucide-react";
import { useFuncionarioActions } from "@/hooks/useFuncionarioActions";
import FuncionarioFormModal from "./FuncionarioFormModal";
import FuncionarioDetailsModal from "./FuncionarioDetailsModal";
import ImportFuncionariosModal from "./ImportFuncionariosModal";
import FuncionarioFilters from "./FuncionarioFilters";
import FuncionarioTable from "./FuncionarioTable";
import DeleteFuncionarioDialog from "./DeleteFuncionarioDialog";
import FuncionarioHeaderActions from "./FuncionarioHeaderActions";
import { Funcionario } from "@/types/funcionario";

interface FuncionarioPageProps {
  openImageModal?: (funcionario: Funcionario) => void;
}

const FuncionarioPage: React.FC<FuncionarioPageProps> = ({ openImageModal }) => {
  const {
    // Estado
    filters,
    currentFuncionario,
    isFormModalOpen,
    isDetailsModalOpen,
    isImportModalOpen,
    isDeleteModalOpen,
    deletingFuncionario,
    isDeleting,
    isImporting,
    isSubmitting,
    deleteErrorMessage,
    funcionarios,
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
    handleSaveFuncionario,
    refetch,
    exportToExcel,
    handleImport
  } = useFuncionarioActions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Cadastro de Funcionários</h1>
        </div>
        
        <FuncionarioHeaderActions 
          onNew={() => openFormModal()}
          onExport={exportToExcel}
          onImport={() => setIsImportModalOpen(true)}
        />
      </div>
      
      <FuncionarioFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
      />
      
      <FuncionarioTable 
        funcionarios={funcionarios || []}
        isLoading={isLoading}
        isError={isError}
        onEdit={openFormModal}
        onView={openDetailsModal}
        onDelete={confirmDelete}
        openImageModal={openImageModal}
      />
      
      <FuncionarioFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        funcionario={currentFuncionario}
        onSubmit={handleSaveFuncionario} 
        isSubmitting={isSubmitting}
      />
      
      <FuncionarioDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        funcionario={currentFuncionario}
      />
      
      <ImportFuncionariosModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        isImporting={isImporting}
      />
      
      <DeleteFuncionarioDialog
        isOpen={isDeleteModalOpen}
        isDeleting={isDeleting}
        funcionarioId={deletingFuncionario?.id}
        funcionarioNome={deletingFuncionario?.nome_completo}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        errorMessage={deleteErrorMessage}
      />
    </div>
  );
};

export default FuncionarioPage;
