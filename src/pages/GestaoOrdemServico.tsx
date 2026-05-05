
import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { FileDown, Wrench, CheckCircle, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrdemServico } from "@/hooks/useOrdemServico";
import OsFilters from "@/components/ordens-servico/OsFilters";
import ChamadosOsTable from "@/components/ordens-servico/ChamadosOsTable";
import OrdensServicoTable from "@/components/ordens-servico/OrdensServicoTable";
import ChamadoDetailsModal from "@/components/ordens-servico/ChamadoDetailsModal";
import DetailedOsModal from "@/components/ordens-servico/DetailedOsModal";
import SimpleOsForm from "@/components/ordens-servico/SimpleOsForm";
import CompleteOsForm from "@/components/ordens-servico/CompleteOsForm";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useVeiculos } from "@/hooks/useVeiculos";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";

const GestaoOrdemServico: React.FC = () => {
  usePageTitle("Gestão de Ordens de Serviço");
  const { toast } = useToast();
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canDeleteOSItem =
    isSuperAdmin || hasActionPermission('requisicoes_gestao_os_view', 'excluir');
  const canExportOS =
    isSuperAdmin || hasActionPermission('requisicoes_gestao_os_view', 'visualizar');
  const { funcionarios } = useFuncionarios();
  const { veiculos } = useVeiculos();
  const [departamentosDropdown, setDepartamentosDropdown] = useState<Array<{id: string; nome_departamento: string}>>([]);
  
  const {
    openChamados,
    ordensServico,
    isLoading,
    isError,
    errorMessage,
    currentUser,
    currentOs,
    currentChamado,
    materials,
    laborItems,
    movements,
    isOsModalOpen,
    setIsOsModalOpen,
    isDetailsModalOpen, 
    setIsDetailsModalOpen,
    isOsDetailsModalOpen,
    setIsOsDetailsModalOpen,
    isChamadoModalOpen,
    setIsChamadoModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    activeTab,
    handleTabChange,
    handleOpenChamadoDetails,
    handleOpenOsModal,
    handleOpenDetailsModal,
    handleOpenOsDetailsModal,
    handleConvertToOs,
    handleCreateOrUpdateOs,
    handleSaveMaterial,
    handleDeleteMaterial,
    handleSaveMaoDeObra,
    handleDeleteMaoDeObra,
    handleApplyChamadoFilters,
    handleApplyOsFilters,
    handleClearFilters,
    handleExportToExcel,
    handleGeneratePdf,
    handleFinishOs
  } = useOrdemServico();

  useEffect(() => {
    const loadDropdownOptions = async () => {
      try {        
        const { data: departamentos, error: deptError } = await supabase
          .from('bd_departamentos')
          .select('id, nome_departamento');
        
        if (deptError) {
          console.error('Error loading departamentos:', deptError);
        } else if (departamentos) {
          setDepartamentosDropdown(departamentos || []);
        }
      } catch (error) {
        console.error('Error loading dropdown options:', error);
      }
    };
    
    loadDropdownOptions();
  }, []);

  const handleDirectConversion = (chamado: any) => {
    if (!currentUser) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado. Faça login novamente.",
        variant: "destructive"
      });
      return;
    }
    
    if (chamado.status !== 'Aberto') {
      toast({
        title: "Aviso",
        description: `Chamado #${chamado.numero_chamado} já foi convertido ou está em processamento.`,
        variant: "default"
      });
      return;
    }
    
    const tipoFalha = chamado.tipo_falha || 'Mecânica';
    
    handleConvertToOs(chamado.id, { tipo_servico: tipoFalha });
  };

  const guardedExport = (...args: any[]) => {
    if (!canExportOS) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para esta ação.',
        variant: 'destructive',
      });
      return;
    }
    return (handleExportToExcel as any)(...args);
  };

  const guardedDeleteMaterial = (...args: any[]) => {
    if (!canDeleteOSItem) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para esta ação.',
        variant: 'destructive',
      });
      return;
    }
    return (handleDeleteMaterial as any)(...args);
  };

  const guardedDeleteMaoDeObra = (...args: any[]) => {
    if (!canDeleteOSItem) {
      toast({
        title: 'Sem permissão',
        description: 'Você não tem permissão para esta ação.',
        variant: 'destructive',
      });
      return;
    }
    return (handleDeleteMaoDeObra as any)(...args);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="flex space-x-2">
            <Button 
              onClick={guardedExport}
              variant="outline"
              disabled={!canExportOS}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chamados">Chamados para Conversão</TabsTrigger>
            <TabsTrigger value="ordens">Ordens de Serviço</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chamados" className="mt-6">
            <OsFilters
              onApplyFilters={handleApplyChamadoFilters}
              onClearFilters={handleClearFilters}
              veiculosOptions={veiculos.map(v => ({ id: v.id, label: v.nome_caminhao }))}
              isLoading={isLoading}
              showStatusFilter={false}
              showPriorityFilter={true}
            />
            
            <ChamadosOsTable
              chamados={openChamados}
              onConvert={handleDirectConversion}
              onView={handleOpenChamadoDetails}
              isLoading={isLoading}
              isError={isError}
              errorMessage={errorMessage}
            />
          </TabsContent>
          
          <TabsContent value="ordens" className="mt-6">
            <OsFilters
              onApplyFilters={handleApplyOsFilters}
              onClearFilters={handleClearFilters}
              veiculosOptions={veiculos.map(v => ({ id: v.id, label: v.nome_caminhao }))}
              isLoading={isLoading}
              showStatusFilter={true}
              showPriorityFilter={false}
            />
            
            <OrdensServicoTable
              ordensServico={ordensServico}
              onView={(osId: string) => {
                const os = ordensServico.find(o => o.id === osId);
                if (os) handleOpenOsDetailsModal(os);
              }}
              onEdit={handleOpenOsModal}
              isLoading={isLoading}
              isError={isError}
              errorMessage={errorMessage}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ChamadoDetailsModal
        isOpen={isChamadoModalOpen}
        onClose={() => setIsChamadoModalOpen(false)}
        onConvert={handleDirectConversion}
        chamado={currentChamado}
        isLoading={isLoading}
      />

      <DetailedOsModal
        isOpen={isOsDetailsModalOpen}
        onClose={() => setIsOsDetailsModalOpen(false)}
        os={currentOs}
        materials={materials}
        laborItems={laborItems}
        movements={movements}
        isLoading={isLoading}
        onGeneratePdf={handleGeneratePdf}
      />

      <CompleteOsForm
        isOpen={isOsModalOpen}
        onClose={() => setIsOsModalOpen(false)}
        onSubmit={handleCreateOrUpdateOs}
        currentOs={currentOs}
        isLoading={isLoading}
        veiculosDropdown={veiculos}
        funcionarios={funcionarios}
        materials={materials}
        laborItems={laborItems}
        movements={movements}
        onSaveMaterial={handleSaveMaterial}
        onDeleteMaterial={guardedDeleteMaterial}
        onSaveMaoDeObra={handleSaveMaoDeObra}
        onDeleteMaoDeObra={guardedDeleteMaoDeObra}
        chamadoId={currentChamado?.id}
      />
    </MainLayout>
  );
};

export default GestaoOrdemServico;
