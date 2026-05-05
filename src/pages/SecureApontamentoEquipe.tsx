
import React, { useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MainLayout from "@/components/layout/MainLayout";
import SecureApontamentoEquipeFilters from "@/components/apontamento-equipe/SecureApontamentoEquipeFilters";
import ApontamentoEquipeTable from "@/components/apontamento-equipe/ApontamentoEquipeTable";
import ApontamentoEquipeForm from "@/components/apontamento-equipe/ApontamentoEquipeForm";
import ApontamentoEquipeDetailsModal from "@/components/apontamento-equipe/ApontamentoEquipeDetailsModal";
import DeleteApontamentoEquipeDialog from "@/components/apontamento-equipe/DeleteApontamentoEquipeDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Plus, Users, Shield, AlertCircle } from "lucide-react";
import { useSecureApontamentoEquipe } from "@/hooks/useSecureApontamentoEquipe";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const SecureApontamentoEquipe: React.FC = () => {
  usePageTitle("Apontamento de Equipe");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [avaliacaoStatusMap] = useState(new Map());
  
  const {
    apontamentos,
    apontamentoSummaries,
    equipes,
    allowedTeamIds,
    userRole,
    canAccessAllTeams,
    isLoading,
    isFormModalOpen,
    setIsFormModalOpen,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    currentApontamento,
    deletingApontamento,
    filters,
    handleFilterChange,
    resetFilters,
    openFormModal,
    openDetailsModal,
    confirmDelete,
    handleDelete,
    handleExport,
    createMutation,
    updateMutation,
    isDeleting
  } = useSecureApontamentoEquipe();

  // Debug logs
  console.log("🔍 Debug SecureApontamentoEquipe - allowedTeamIds:", allowedTeamIds);
  console.log("🔍 Debug SecureApontamentoEquipe - userRole:", userRole);
  console.log("🔍 Debug SecureApontamentoEquipe - apontamentos count:", apontamentos.length);
  console.log("🔍 Debug SecureApontamentoEquipe - summaries count:", apontamentoSummaries.length);
  console.log("🔍 Debug SecureApontamentoEquipe - sample summary:", apontamentoSummaries[0]);

  const handleViewEquipe = (equipeId: string) => {
    navigate(`/gestao-rh/equipes?id=${equipeId}`);
  };

  const handleAvaliarColaborador = () => {
    // Placeholder - implementar conforme necessário
  };

  const formattedDate = format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canCreateApontamento = isSuperAdmin || hasActionPermission('requisicoes_apontamento_equipe_view', 'criar');
  const canExportApontamento = isSuperAdmin || hasActionPermission('requisicoes_apontamento_equipe_view', 'visualizar');
  const canDeleteApontamento = isSuperAdmin || hasActionPermission('requisicoes_apontamento_equipe_view', 'excluir');

  const guardedExport = () => {
    if (!canExportApontamento) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    handleExport();
  };

  const guardedDelete = () => {
    if (!canDeleteApontamento) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    handleDelete();
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div></div>
          <div className="flex gap-2 w-full sm:w-auto flex-row justify-end">
            {canCreateApontamento && allowedTeamIds.length > 0 && (
              <Button 
                onClick={() => openFormModal()} 
                className="h-8 sm:h-10 px-2 sm:px-4 text-sm"
                size="xs"
              >
                <Plus className="mr-2 h-4 w-4" />
                <span>Novo Apontamento</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={guardedExport} 
              className="h-8 sm:h-10 px-2 sm:px-4 text-sm"
              size="xs"
              disabled={!canExportApontamento || apontamentos.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              <span>Exportar</span>
            </Button>
          </div>
        </div>

        {/* Security Status Alert */}
        <Alert className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800">
          <Shield className="h-4 w-4" />
          <AlertTitle>Controle de Acesso Ativo</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col gap-1">
              <span>Role: <strong>{userRole}</strong></span>
              <span>Acesso: {canAccessAllTeams ? 'Todas as equipes' : `${allowedTeamIds.length} equipes permitidas`}</span>
              <span>RLS: <strong>Habilitado</strong> - Dados filtrados automaticamente</span>
            </div>
          </AlertDescription>
        </Alert>

        {/* No Access Warning */}
        {allowedTeamIds.length === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sem Acesso a Equipes</AlertTitle>
            <AlertDescription>
              Você não tem permissão para acessar nenhuma equipe. Entre em contato com o administrador para solicitar as permissões necessárias.
            </AlertDescription>
          </Alert>
        )}

        {allowedTeamIds.length > 0 && (
          <>
            <SecureApontamentoEquipeFilters 
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={resetFilters}
              equipes={equipes as any}
              allowedTeamIds={allowedTeamIds}
              isLoading={isLoading}
            />

            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <CardTitle className="text-xl">Apontamentos de Equipe</CardTitle>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium capitalize text-sm">{formattedDate}</span>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <ApontamentoEquipeTable 
                    apontamentos={apontamentoSummaries} 
                    onViewDetails={openDetailsModal}
                    onEdit={openFormModal}
                    onDelete={confirmDelete}
                    onViewEquipe={handleViewEquipe}
                    onAvaliarColaborador={handleAvaliarColaborador}
                    avaliacaoStatusMap={avaliacaoStatusMap}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Form Modal */}
        <ApontamentoEquipeForm 
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSubmit={(data) => currentApontamento ? updateMutation.mutate(data) : createMutation.mutate(data)}
          currentApontamento={currentApontamento}
          equipes={(equipes as any).filter((e: any) => allowedTeamIds.includes(e.id))}
          isLoading={createMutation.isPending || updateMutation.isPending}
          onAvaliarColaborador={handleAvaliarColaborador}
          avaliacaoStatusMap={avaliacaoStatusMap}
          isAvaliacaoObrigatoria={false}
        />

        {/* Details Modal */}
        {currentApontamento && (
          <ApontamentoEquipeDetailsModal 
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            apontamento={currentApontamento}
            apontamentosList={apontamentos.filter(a => 
              a.equipe_id === currentApontamento.equipe_id && 
              a.data_registro === currentApontamento.data_registro
            )}
          />
        )}

        {/* Delete Dialog */}
        <DeleteApontamentoEquipeDialog 
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          apontamento={deletingApontamento}
          onDelete={guardedDelete}
          isDeleting={isDeleting}
        />
      </div>
    </MainLayout>
  );
};

export default SecureApontamentoEquipe;
