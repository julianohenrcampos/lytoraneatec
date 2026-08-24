
import React, { useState } from "react";

import { useVeiculoActions } from "@/hooks/useVeiculoActions";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import VeiculoFilters from "./VeiculoFilters";
import VeiculoTable from "./VeiculoTable";
import VeiculoFormModal from "./VeiculoFormModal";
import VeiculoDetailsModal from "./VeiculoDetailsModal";
import ImportadorV3Modal from "./import/ImportadorV3Modal";
import ImportadorV2Wizard from "./import/ImportadorV2Wizard";
import DeleteVeiculoDialog from "./DeleteVeiculoDialog";
import VeiculoHeaderActions from "./VeiculoHeaderActions";
import GerenciarCategoriasModal from "./GerenciarCategoriasModal";
import GerenciarSubcategoriasModal from "./GerenciarSubcategoriasModal";
import GerenciarFrotasModal from "./GerenciarFrotasModal";
import GerenciarLinhasOperacionaisModal from "./GerenciarLinhasOperacionaisModal";
import {
  hidratarExportacaoV3Simplificado,
  calcularArquivoSha256LogicoV3,
  gerarWorkbookV3Simplificado,
  bytesToXlsxBlob,
} from "@/services/veiculo/importV3";
import { baixarBlob } from "@/services/veiculo/importV3/gerarRelatorioV3";
import { VeiculoFormData } from "@/types/veiculo";

interface VeiculoPageProps {
  initialSituacaoFilter?: string | null;
}

const VeiculoPage: React.FC<VeiculoPageProps> = ({ initialSituacaoFilter }) => {
  const [isSuccessMessageVisible, setIsSuccessMessageVisible] = useState(false);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isSubcategoriaModalOpen, setIsSubcategoriaModalOpen] = useState(false);
  const [isFrotaModalOpen, setIsFrotaModalOpen] = useState(false);
  const [isLinhaOperacionalModalOpen, setIsLinhaOperacionalModalOpen] = useState(false);
  const [isImportV2Open, setIsImportV2Open] = useState(false);
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const { toast } = useToast();
  const canDeleteVeiculo =
    isSuperAdmin || hasActionPermission("gestao_maquinas_caminhoes_view", "excluir");
  const canExportVeiculo =
    isSuperAdmin || hasActionPermission("gestao_maquinas_caminhoes_view", "visualizar");
  const importadorV2LegadoEnabled =
    String(import.meta.env.VITE_IMPORTADOR_V2_LEGADO_ENABLED ?? '').toLowerCase() === 'true';
  const canSeeImportadorV2 = isSuperAdmin && importadorV2LegadoEnabled;
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
    categoriasDropdown,
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

  const guardedDeleteVeiculo = async () => {
    if (!canDeleteVeiculo) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    await handleDelete();
  };

  const guardedExportVeiculo = async () => {
    if (!canExportVeiculo) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    try {
      toast({ title: "Exportando…", description: "Consultando o banco e montando o arquivo V3 simplificado." });
      const { registros, listas, total } = await hidratarExportacaoV3Simplificado();
      const sha = await calcularArquivoSha256LogicoV3({
        tipo_arquivo: 'EXPORTACAO',
        linhas: registros as unknown as Array<Partial<Record<string, string | number | null>>>,
      });
      const bytes = await gerarWorkbookV3Simplificado({
        tipo_arquivo: 'EXPORTACAO',
        listas,
        registros,
        arquivo_sha256_logico: sha,
        gerado_por: 'ui.veiculo_page',
        observacoes: 'Exportação oficial V3 simplificado — 20 colunas visíveis + _controle_ref.',
      });
      const stamp = new Date().toISOString().slice(0, 10);
      baixarBlob(bytesToXlsxBlob(bytes), `Equipamentos_${stamp}_V3.xlsx`);
      toast({ title: "Exportação concluída", description: `${total} ativos exportados no formato V3 simplificado.` });
    } catch (err) {
      toast({
        title: "Falha ao exportar",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <VeiculoHeaderActions 
          onExport={guardedExportVeiculo}
          onImport={() => setIsImportModalOpen(true)}
          onImportV2DryRun={canSeeImportadorV2 ? () => setIsImportV2Open(true) : undefined}
          onNewClick={() => openFormModal()}
          onManageCategorias={() => setIsCategoriaModalOpen(true)}
          onManageSubcategorias={() => setIsSubcategoriaModalOpen(true)}
          onManageFrotas={() => setIsFrotaModalOpen(true)}
          onManageLinhasOperacionais={() => setIsLinhaOperacionalModalOpen(true)}
          canExport={canExportVeiculo}
        />
      </div>
      
      {isSuccessMessageVisible && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">Importação concluída com sucesso!</span>
        </div>
      )}
      
      <VeiculoFilters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={resetFilters}
        isLoading={isLoading}
        totalVeiculos={veiculos?.length || 0}
        categorias={categoriasDropdown}
        departamentos={departamentosDropdown || []}
      />
      
      <VeiculoTable 
        veiculos={veiculos}
        isLoading={isLoading}
        isError={isError}
        onEdit={openFormModal}
        onView={openDetailsModal}
        onDelete={confirmDelete}
        canDelete={canDeleteVeiculo}
      />
      
      <VeiculoFormModal 
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        veiculo={currentVeiculo}
        onSuccess={refetch}
        onSave={handleSaveVeiculo}
        departamentos={departamentosDropdown || []}
        empresas={empresasDropdown || []}
        categorias={categoriasDropdown || []}
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
        onConfirm={guardedDeleteVeiculo}
      />
      
      <ImportadorV3Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSucesso={handleImportSuccess}
      />

      {canSeeImportadorV2 && (
        <ImportadorV2Wizard
          isOpen={isImportV2Open}
          onClose={() => setIsImportV2Open(false)}
        />
      )}

      <GerenciarCategoriasModal
        isOpen={isCategoriaModalOpen}
        onClose={() => setIsCategoriaModalOpen(false)}
        canDelete={canDeleteVeiculo}
      />

      <GerenciarSubcategoriasModal
        isOpen={isSubcategoriaModalOpen}
        onClose={() => setIsSubcategoriaModalOpen(false)}
        categorias={categoriasDropdown}
        canDelete={canDeleteVeiculo}
      />

      <GerenciarFrotasModal
        isOpen={isFrotaModalOpen}
        onClose={() => setIsFrotaModalOpen(false)}
        canDelete={canDeleteVeiculo}
      />

      <GerenciarLinhasOperacionaisModal
        isOpen={isLinhaOperacionalModalOpen}
        onClose={() => setIsLinhaOperacionalModalOpen(false)}
        canDelete={canDeleteVeiculo}
      />
    </div>
  );
};

export default VeiculoPage;
