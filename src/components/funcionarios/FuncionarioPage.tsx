
import React, { useState, Suspense, lazy } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Download, Upload, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const DesligamentosSection = lazy(() => import("@/components/desligamento/sections/DesligamentosSection"));
const SolicitacoesDesligamentoSection = lazy(() => import("@/components/desligamento/sections/SolicitacoesDesligamentoSection"));
const SolicitacoesTransferenciaSection = lazy(() => import("@/components/desligamento/sections/SolicitacoesTransferenciaSection"));
const SolicitacoesClassificacaoSection = lazy(() => import("@/components/funcionarios/classificacao/sections/SolicitacoesClassificacaoSection"));

interface FuncionarioPageProps {
  openImageModal?: (funcionario: any) => void;
}

const VALID_TABS = ['funcionarios', 'desligamentos', 'solicitacoes-desligamento', 'solicitacoes-transferencia', 'solicitacoes-classificacao'] as const;
type TabKey = typeof VALID_TABS[number];

const SectionFallback = () => (
  <div className="flex justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const FuncionarioPage: React.FC<FuncionarioPageProps> = ({ openImageModal }) => {
  const [isEmailConfirmationOpen, setIsEmailConfirmationOpen] = useState(false);
  const [classificacaoOpen, setClassificacaoOpen] = useState(false);
  const [funcionarioClassificacao, setFuncionarioClassificacao] = useState<Funcionario | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const { isSuperAdmin, hasActionPermission, hasPermission } = usePermission();

  const fallback = (acao: 'visualizar' | 'criar' | 'editar') =>
    hasActionPermission('gestao_rh_funcionarios_view', acao);

  const canSeeDesligamentos =
    isSuperAdmin ||
    hasPermission('gestao_rh_desligamentos_view') ||
    fallback('visualizar');
  const canSeeSolDesl =
    isSuperAdmin ||
    hasPermission('gestao_rh_solicitacoes_desligamento_view') ||
    fallback('visualizar');
  const canSeeSolTrans =
    isSuperAdmin ||
    hasPermission('gestao_rh_solicitacoes_transferencia_view') ||
    fallback('visualizar');
  const canSeeSolClass =
    isSuperAdmin ||
    hasActionPermission('gestao_rh_solicitacoes_classificacao_view', 'visualizar');

  const tabAllowed = (t: TabKey): boolean => {
    switch (t) {
      case 'funcionarios': return true;
      case 'desligamentos': return canSeeDesligamentos;
      case 'solicitacoes-desligamento': return canSeeSolDesl;
      case 'solicitacoes-transferencia': return canSeeSolTrans;
      case 'solicitacoes-classificacao': return canSeeSolClass;
      default: return false;
    }
  };

  const activeTab: TabKey =
    tabParam && VALID_TABS.includes(tabParam) && tabAllowed(tabParam)
      ? tabParam
      : 'funcionarios';

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'funcionarios') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

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
    setCurrentFuncionario,
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

  const canCreate = isSuperAdmin || hasActionPermission('gestao_rh_funcionarios_view', 'criar');
  const canEdit = isSuperAdmin || hasActionPermission('gestao_rh_funcionarios_view', 'editar');
  const canDelete = isSuperAdmin || hasActionPermission('gestao_rh_funcionarios_view', 'excluir');
  const canSolicitarClassificacao =
    isSuperAdmin ||
    hasActionPermission('gestao_rh_funcionarios_classificacao_solicitar', 'criar');
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
    if (!canSolicitarClassificacao) { toast.error(DENIED_MSG); return; }
    handleBaixarClassificacao(f);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          {canSeeDesligamentos && (
            <TabsTrigger value="desligamentos">Desligamentos</TabsTrigger>
          )}
          {canSeeSolDesl && (
            <TabsTrigger value="solicitacoes-desligamento">Solicitações de Desligamento</TabsTrigger>
          )}
          {canSeeSolTrans && (
            <TabsTrigger value="solicitacoes-transferencia">Solicitações de Transferência</TabsTrigger>
          )}
          {canSeeSolClass && (
            <TabsTrigger value="solicitacoes-classificacao">Solicitações de Classificação</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="funcionarios" className="space-y-6 mt-0">
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

<<<<<<< HEAD
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
        canSolicitarClassificacao={canSolicitarClassificacao}
      />
=======
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
            canSolicitarClassificacao={canSolicitarClassificacao}
          />
        </TabsContent>

        {canSeeDesligamentos && (
          <TabsContent value="desligamentos" className="mt-0">
            <Suspense fallback={<SectionFallback />}>
              <DesligamentosSection />
            </Suspense>
          </TabsContent>
        )}

        {canSeeSolDesl && (
          <TabsContent value="solicitacoes-desligamento" className="mt-0">
            <Suspense fallback={<SectionFallback />}>
              <SolicitacoesDesligamentoSection />
            </Suspense>
          </TabsContent>
        )}

        {canSeeSolTrans && (
          <TabsContent value="solicitacoes-transferencia" className="mt-0">
            <Suspense fallback={<SectionFallback />}>
              <SolicitacoesTransferenciaSection />
            </Suspense>
          </TabsContent>
        )}

        {canSeeSolClass && (
          <TabsContent value="solicitacoes-classificacao" className="mt-0">
            <Suspense fallback={<SectionFallback />}>
              <SolicitacoesClassificacaoSection />
            </Suspense>
          </TabsContent>
        )}
      </Tabs>
>>>>>>> 52562f7989b0a86f866e932d6c49a2bc9dd1bc12

      <FuncionarioFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
<<<<<<< HEAD
          // Limpa funcionário selecionado para evitar vazamento entre create/edit
=======
>>>>>>> 52562f7989b0a86f866e932d6c49a2bc9dd1bc12
          setTimeout(() => setCurrentFuncionario(null), 0);
        }}
        funcionario={currentFuncionario}
        onSubmit={handleSaveFuncionario}
        isSubmitting={isSubmitting}
      />

      <FuncionarioDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setTimeout(() => setCurrentFuncionario(null), 0);
        }}
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
