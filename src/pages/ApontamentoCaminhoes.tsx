
import React from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
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
import { useIsMobile } from "@/hooks/use-mobile";

const ApontamentoCaminhoes: React.FC = () => {
  usePageTitle("Apontamento de C&E");
  useApontamentoCaminhoesInit();
  const { centrosCusto } = useCentrosCusto();
  const isMobile = useIsMobile();
  
  const {
    apontamentos,
    isLoading,
    veiculosDropdown,
    operadoresDropdown,
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
  const centrosCustoOptions = centrosCusto.map(centro => ({
    id: centro.id,
    label: centro.codigo_centro_custo
  }));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <div className="flex space-x-2 w-full sm:w-auto">
            <Button 
              onClick={() => handleOpenFormModal()}
              className="flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Apontamento
            </Button>
            
            {!isMobile && (
              <Button 
                onClick={handleExportToExcel}
                variant="outline"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            )}
          </div>
        </div>

        <ApontamentoCaminhoesFilters
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
          veiculosOptions={veiculosDropdown}
          operadoresOptions={operadoresDropdown}
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
        
        {isMobile && apontamentos.length > 0 && (
          <div className="fixed bottom-4 right-4">
            <Button 
              onClick={handleExportToExcel}
              variant="outline" 
              size="sm"
              className="rounded-full shadow-lg"
            >
              <FileDown className="h-4 w-4 mr-1" />
              Exportar
            </Button>
          </div>
        )}
      </div>

      <ApontamentoCaminhoesForm
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        currentApontamento={currentApontamento}
        veiculosOptions={veiculosDropdown}
        operadoresOptions={operadoresDropdown}
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
