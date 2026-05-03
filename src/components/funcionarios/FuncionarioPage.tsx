
import React, { useState } from "react";
import { Users, Download, Upload, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFuncionarioActions } from "@/hooks/useFuncionarioActions";
import { usePermission } from "@/hooks/usePermission";
import FuncionarioTable from "./FuncionarioTable";
import FuncionarioFilters from "./FuncionarioFilters";
import FuncionarioFormModal from "./FuncionarioFormModal";
import FuncionarioDetailsModal from "./FuncionarioDetailsModal";
import FuncionarioImportModal from "./FuncionarioImportModal";
import DeleteFuncionarioDialog from "./DeleteFuncionarioDialog";
import EmailConfirmationModal from "./EmailConfirmationModal";
import CenterAlert from "@/components/ui/CenterAlert";
import BaixarClassificacaoModal from "./classificacao/BaixarClassificacaoModal";
import { Funcionario } from "@/types/funcionario";

interface FuncionarioPageProps {
  openImageModal?: (funcionario: any) => void;
}

const FuncionarioPage: React.FC<FuncionarioPageProps> = ({ openImageModal }) => {
  const [isEmailConfirmationOpen, setIsEmailConfirmationOpen] = useState(false);
  const [classificacaoOpen, setClassificacaoOpen] = useState(false);
  const [funcionarioClassificacao, setFuncionarioClassificacao] = useState<Funcionario | null>(null);

  const handleBaixarClassificacao = (f: Funcionario) => {
    setFuncionarioClassificacao(f);
    setClassificacaoOpen(true);
  };
  
  const {
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
    centerAlert,
    closeCenterAlert,
    funcionarios,
    isLoading,
    isError,
    error,
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
    exportSemDadosBancarios,
    handleImport
  } = useFuncionarioActions();

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_funcionarios_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_funcionarios_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_funcionarios_view', 'excluir');
  const DENIED_MSG = "Você não tem permissão para executar esta ação.";

  const handleOpenFormModal = (f?: Funcionario) => {
    if (f && !canEdit) { toast.error(DENIED_MSG); return; }
    if (!f && !canCreate) { toast.error(DENIED_MSG); return; }
    openFormModal(f);
  };
  const handleOpenImport = () => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    setIsImportModalOpen(true);
  };
  const handleConfirmDelete = (f: Funcionario) => {
    if (!canDelete) { toast.error(DENIED_MSG); return; }
    confirmDelete(f);
  };
  const handleBaixarClassificacaoGated = (f: Funcionario) => {
    if (!canCreate) { toast.error(DENIED_MSG); return; }
    handleBaixarClassificacao(f);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading || !funcionarios?.length}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToExcel}>
                Exportar Completo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportSemDadosBancarios}>
                Sem Dados Bancários
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenImport}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Importar
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => handleOpenFormModal()}>
              Novo Funcionário
            </Button>
          )}
        </div>
      </div>

      <FuncionarioFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
      />


      <FuncionarioTable
        funcionarios={funcionarios || []}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onEdit={handleOpenFormModal}
        onDelete={handleConfirmDelete}
        canEdit={canEdit}
        canDelete={canDelete}
        canCreate={canCreate}
        onViewDetails={openDetailsModal}
        onRefetch={refetch}
        openImageModal={openImageModal}
        onBaixarClassificacao={handleBaixarClassificacaoGated}
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

      <FuncionarioImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        isImporting={isImporting}
      />

      <DeleteFuncionarioDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        funcionarioId={deletingFuncionario?.id}
        funcionarioNome={deletingFuncionario?.nome_completo}
        isDeleting={isDeleting}
        errorMessage={deleteErrorMessage}
      />

      <EmailConfirmationModal
        isOpen={isEmailConfirmationOpen}
        onClose={() => setIsEmailConfirmationOpen(false)}
      />

      <CenterAlert
        isOpen={centerAlert.isOpen}
        message={centerAlert.message}
        type={centerAlert.type}
        onClose={closeCenterAlert}
      />

      <BaixarClassificacaoModal
        open={classificacaoOpen}
        onOpenChange={setClassificacaoOpen}
        funcionario={funcionarioClassificacao}
      />
    </div>
  );
};

export default FuncionarioPage;
