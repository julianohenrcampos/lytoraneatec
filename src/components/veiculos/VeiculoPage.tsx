import React, { useState } from "react";
import { Truck } from "lucide-react";
import { useVeiculoActions } from "@/hooks/useVeiculoActions";
import VeiculoTable from "./VeiculoTable";
import VeiculoFormModal from "./VeiculoFormModal";
import VeiculoDetailsModal from "./VeiculoDetailsModal";
import ImportVeiculosModal from "./ImportVeiculosModal";
import DeleteVeiculoDialog from "./DeleteVeiculoDialog";
import VeiculoHeaderActions from "./VeiculoHeaderActions";
import { VeiculoFormData } from "@/types/veiculo";

const VeiculoPage: React.FC = () => {
  const [isSuccessMessageVisible, setIsSuccessMessageVisible] = useState(false);
  const [placaFiltro, setPlacaFiltro] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const {
    veiculos,
    isLoading,
    isError,
    currentVeiculo,
    filters,
    isFormModalOpen,
    isDetailsModalOpen,
    isDeleteModalOpen,
    isImportModalOpen,
    deletingVeiculo,
    departamentosDropdown,
    empresasDropdown,
    openFormModal,
    openDetailsModal,
    confirmDelete,
    setIsImportModalOpen,
    setIsFormModalOpen,
    setIsDetailsModalOpen,
    setIsDeleteModalOpen,
    handleFilterChange,
    resetFilters,
    exportToExcel,
    refetch,
    handleDelete,
    handleSaveVeiculo,
    handleImport
  } = useVeiculoActions();

  const handleImportSuccess = async () => {
    await refetch();
    setIsImportModalOpen(false);

    setIsSuccessMessageVisible(true);
    setTimeout(() => {
      setIsSuccessMessageVisible(false);
    }, 5000);
  };

  const handleImportWrapper = async (veiculos: VeiculoFormData[]): Promise<{ success: any[]; errors: any[] }> => {
    try {
      const result = await handleImport(veiculos);
      return result;
    } catch (error) {
      console.error("Error in import wrapper:", error);
      return { success: [], errors: [{ message: error instanceof Error ? error.message : "Erro desconhecido" }] };
    }
  };

  const placasUnicas = [...new Set(veiculos?.map(v => v.placa).filter(Boolean))];

  const placasFiltradas = placasUnicas.filter(p =>
    p.toLowerCase().includes(placaFiltro.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Cadastro de C/E</h1>
        </div>

        <VeiculoHeaderActions
          onExport={exportToExcel}
          onImport={() => setIsImportModalOpen(true)}
          onNewClick={() => openFormModal()}
        />
      </div>

      {isSuccessMessageVisible && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">Importação concluída com sucesso!</span>
        </div>
      )}

      {/* Campo de filtro de placa com autocomplete */}
      <div className="bg-white p-4 rounded-md border shadow-sm">
        <div className="max-w-md relative">
          <label className="text-sm font-medium text-gray-700">Placa</label>
          <input
            type="text"
            className="w-full border px-3 py-2 rounded mt-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Digite a placa"
            value={placaFiltro}
            onChange={(e) => {
              setPlacaFiltro(e.target.value);
              handleFilterChange("placa", e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
          {showDropdown && placasFiltradas.length > 0 && (
            <ul className="absolute top-[100%] mt-1 z-10 w-full bg-white border rounded shadow max-h-48 overflow-y-auto">
              {placasFiltradas.map((placa, index) => (
                <li
                  key={index}
                  onClick={() => {
                    setPlacaFiltro(placa);
                    handleFilterChange("placa", placa);
                    setShowDropdown(false);
                  }}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                >
                  {placa}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => {
              setPlacaFiltro("");
              resetFilters();
            }}
            className="mt-2 text-sm text-gray-600 hover:underline"
          >
            Limpar filtro
          </button>
        </div>
      </div>

      <VeiculoTable
        veiculos={veiculos}
        isLoading={isLoading}
        isError={isError}
        onEdit={openFormModal}
        onView={openDetailsModal}
        onDelete={confirmDelete}
      />

      <VeiculoFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        veiculo={currentVeiculo}
        onSuccess={refetch}
        onSave={handleSaveVeiculo}
        departamentos={departamentosDropdown || []}
        empresas={empresasDropdown || []}
      />

      <VeiculoDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        veiculo={currentVeiculo}
      />

      <DeleteVeiculoDialog
        isOpen={isDeleteModalOpen}
        isDeleting={false}
        veiculo={deletingVeiculo || currentVeiculo}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />

      <ImportVeiculosModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportWrapper}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default VeiculoPage;
