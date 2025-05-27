
import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import RegistroAplicacaoFilters from "@/components/registro-aplicacao/RegistroAplicacaoFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Plus } from "lucide-react";
import { fetchRegistrosAplicacao } from "@/services/registro-aplicacao";
import { exportRegistrosAplicacaoToExcel } from "@/services/registro-aplicacao";
import { RegistroAplicacaoFilters as RegistroAplicacaoFiltersType } from "@/types/registroAplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import NovoApontamentoModal from "@/components/registro-aplicacao/NovoApontamentoModal";
import RegistroAplicacaoTable from "@/components/registro-aplicacao/RegistroAplicacaoTable";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { fetchCentrosCustoFiltered } from "@/services/centrosCustoFilteredService";
import { fetchCaminhoesWithCapacity } from "@/services/caminhoesFilteredService";
import { debugLog } from "@/lib/debug";

const RegistroAplicacao: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [caminhoesList, setCaminhoesList] = useState<any[]>([]);
  const [centrosCustoList, setCentrosCustoList] = useState<any[]>([]);
  const [isNovoApontamentoOpen, setIsNovoApontamentoOpen] = useState(false);
  const [filters, setFilters] = useState<RegistroAplicacaoFiltersType>({
    data_inicio: new Date() // Default to today's date
  });
  
  // Get user permissions and ID
  const { userId, isSuperAdmin } = useAuthPermissions();

  console.log("⚡️ RegistroAplicacao rendering - userId:", userId, "isSuperAdmin:", isSuperAdmin);

  const { 
    data: registrosAplicacao, 
    isLoading: isLoadingRegistros,
    refetch 
  } = useQuery({
    queryKey: ['registrosAplicacao', filters, userId, isSuperAdmin],
    queryFn: () => fetchRegistrosAplicacao(filters, userId, isSuperAdmin),
    refetchOnWindowFocus: false,
  });

  // Load filter data - only once when component mounts
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.log("🔄 Loading filter data - userId:", userId, "isSuperAdmin:", isSuperAdmin);
        
        // Load caminhões
        console.log("🚚 Fetching caminhões...");
        const caminhoesData = await fetchCaminhoesWithCapacity();
        console.log("🚚 Fetched caminhões:", caminhoesData?.length || 0);
        setCaminhoesList(caminhoesData || []);

        // Load centros de custo
        console.log("🏢 Fetching centros de custo...");
        const centrosData = await fetchCentrosCustoFiltered(userId, isSuperAdmin);
        console.log("🏢 Fetched centros de custo:", centrosData?.length || 0);
        setCentrosCustoList(centrosData || []);
        
        console.log("✅ Filter data loaded successfully");
      } catch (error) {
        console.error("❌ Error loading filter data:", error);
        debugLog("Filter Data Error Details", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados dos filtros",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Only load data when userId and isSuperAdmin are available
    if (userId !== null && isSuperAdmin !== null) {
      loadData();
    }
  }, [userId, isSuperAdmin, toast]);

  const handleFilter = useCallback((filters: RegistroAplicacaoFiltersType) => {
    console.log("🔍 Applying filters:", filters);
    setFilters(filters);
  }, []);

  const handleClearFilters = useCallback(() => {
    console.log("🧹 Clearing all filters");
    const defaultFilters = { data_inicio: new Date() };
    setFilters(defaultFilters);
  }, []);

  // Check if there are active filters beyond the default date
  const hasActiveFilters = Boolean(
    filters.centro_custo_id || 
    filters.caminhao_id || 
    (filters.data_inicio && filters.data_inicio.toDateString() !== new Date().toDateString())
  );

  const handleExport = useCallback(() => {
    try {
      if (!registrosAplicacao || registrosAplicacao.length === 0) {
        toast({
          title: "Erro",
          description: "Não há dados para exportar.",
          variant: "destructive",
        });
        return;
      }
      
      // Create a properly formatted array for export
      const exportData = registrosAplicacao.map(registro => {
        // Get the center cost name through multiple possible paths
        const centroCustoNome = 
          registro.lista_entrega?.requisicao?.centro_custo?.nome_centro_custo ||
          "";
          
        // Get the logradouro - prioritize the one directly from registro_apontamento
        const logradouro = registro.logradouro_aplicado || 
                          registro.lista_entrega?.logradouro || 
                          "";
        
        return {
          id: registro.lista_entrega?.id || registro.id,
          data_entrega: registro.data_aplicacao,
          logradouro: logradouro,
          centro_custo_nome: centroCustoNome,
          quantidade_massa: registro.registro_carga?.tonelada_real || 0,
          caminhao: registro.lista_entrega?.caminhao,
          equipe: registro.lista_entrega?.equipe,
          status: "Entregue"
        };
      });
      
      exportRegistrosAplicacaoToExcel(exportData);
      toast({
        title: "Sucesso",
        description: "Dados exportados com sucesso!",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    }
  }, [registrosAplicacao, toast]);

  const handleFormSuccess = useCallback(() => {
    refetch();
    setIsNovoApontamentoOpen(false);
    toast({
      title: "Sucesso",
      description: "Registro de aplicação salvo com sucesso!",
    });
  }, [refetch, toast]);

  const handleNovoApontamento = useCallback(() => {
    setIsNovoApontamentoOpen(true);
  }, []);

  const handleSelectEntrega = useCallback((
    entrega: ListaProgramacaoEntrega,
    registroCarga: RegistroCarga,
    logradouroId?: string,
    logradouroName?: string
  ) => {
    console.log("Selected entrega for new apontamento:", {
      entrega: entrega.logradouro,
      logradouro: logradouroName,
      massa_remanescente: entrega.massa_remanescente
    });
    
    // Here you would typically navigate to a form or open a form modal
    // For now, just close the modal and show success
    handleFormSuccess();
  }, [handleFormSuccess]);

  console.log("📊 Registros aplicacao fetched:", registrosAplicacao?.length || 0);

  return (
    <MainLayout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Registro de Aplicação</h1>
          <div className="flex gap-2">
            <Button 
              onClick={handleExport} 
              variant="outline" 
              className="gap-2"
              disabled={!registrosAplicacao || registrosAplicacao.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button 
              onClick={handleNovoApontamento}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Apontamento
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <RegistroAplicacaoFilters 
            onFilter={handleFilter} 
            caminhoesList={caminhoesList}
            centrosCustoList={centrosCustoList}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">
                {isSuperAdmin 
                  ? "Registros de Aplicação (Todos)" 
                  : "Meus Registros de Aplicação"}
              </CardTitle>
              {isLoadingRegistros && (
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto my-4"></div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <RegistroAplicacaoTable 
                registros={registrosAplicacao || []} 
                isLoading={isLoadingRegistros}
                onRefresh={refetch}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
              />
            </CardContent>
          </Card>
        </div>

        <NovoApontamentoModal
          isOpen={isNovoApontamentoOpen}
          onClose={() => setIsNovoApontamentoOpen(false)}
          onSelectEntrega={handleSelectEntrega}
          selectedDate={filters.data_inicio}
          equipeId={!isSuperAdmin ? userId || undefined : undefined}
        />
      </div>
    </MainLayout>
  );
};

export default RegistroAplicacao;
