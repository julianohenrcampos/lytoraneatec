import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { FileDown, Plus } from "lucide-react";
import { useApontamentoCaminhoes } from "@/hooks/useApontamentoCaminhoes";
import { useApontamentoCaminhoesInit } from "@/hooks/useApontamentoCaminhoesInit";
import ApontamentoCaminhoesTable from "@/components/apontamento-caminhoes/ApontamentoCaminhoesTable";
import ApontamentoCaminhoesFilters from "@/components/apontamento-caminhoes/ApontamentoCaminhoesFilters";
import ApontamentoCaminhoesForm from "@/components/apontamento-caminhoes/ApontamentoCaminhoesForm";
import ApontamentoCaminhoesDetailsModal from "@/components/apontamento-caminhoes/ApontamentoCaminhoesDetailsModal";
import DeleteApontamentoCaminhoesDialog from "@/components/apontamento-caminhoes/DeleteApontamentoCaminhoesDialog";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";

const ApontamentoCaminhoes: React.FC = () => {
  useApontamentoCaminhoesInit();
  const { centrosCusto } = useCentrosCusto();
  
  const {
    apontamentos,
    isLoading,
    veiculosDropdown,
    currentUser,
    isFormModalOpen,
    setIsFormModalOpen,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    currentApontamento,
    handleOpenFormModal,
    handleOpenDetailsModal,
    handleOpenDeleteModal,
    handleCreateOrUpdate,
    handleDelete,
    handleApplyFilters,
    handleClearFilters,
    handleExportToExcel,
    handleGetUltimoHorimetro,
    handleUploadFoto,
  } = useApontamentoCaminhoes();

  const operadoresOptions = currentUser ? [{ id: currentUser.id, label: currentUser.email }] : [];
  const centrosCustoOptions = centrosCusto.map(centro => ({
    id: centro.id,
    label: centro.codigo_centro_custo
  }));

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-4 sm:mb-0">Apontamento de C&E</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={() => handleOpenFormModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Apontamento
            </Button>
            
            <Button 
              onClick={handleExportToExcel}
              variant="outline" 
              className="border-green-200 text-green-700 hover:bg-green-50"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <ApontamentoCaminhoesFilters
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          veiculosOptions={veiculosDropdown}
          operadoresOptions={operadoresOptions}
          centrosCustoOptions={centrosCustoOptions}
          isLoading={isLoading}
        />

        <ApontamentoCaminhoesTable
          apontamentos={apontamentos}
          onView={handleOpenDetailsModal}
          onEdit={handleOpenFormModal}
          onDelete={handleOpenDeleteModal}
          isLoading={isLoading}
        />
      </div>

      <ApontamentoCaminhoesForm
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        currentApontamento={currentApontamento}
        veiculosOptions={veiculosDropdown}
        operadoresOptions={operadoresOptions}
        centrosCustoOptions={centrosCustoOptions}
        isLoading={isLoading}
        currentUser={currentUser}
        getUltimoHorimetro={handleGetUltimoHorimetro}
        uploadFoto={handleUploadFoto}
      />

      <ApontamentoCaminhoesDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        apontamento={currentApontamento.apontamento}
        inspecao={currentApontamento.inspecao}
        isLoading={isLoading}
      />

      <DeleteApontamentoCaminhoesDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isLoading}
      />
    </MainLayout>
  );
};

export default ApontamentoCaminhoes;
