
import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import RegistroAplicacaoFilters from "@/components/registro-aplicacao/RegistroAplicacaoFilters";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchEntregasEnviadas } from "@/services/registro-aplicacao/fetchEntregasEnviadas";
import { RegistroAplicacaoFilters as RegistroAplicacaoFiltersType } from "@/types/registroAplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { fetchCentrosCustoFiltered } from "@/services/centrosCustoFilteredService";
import { fetchCaminhoesWithCapacity } from "@/services/caminhoesFilteredService";
import EntregasEnviadasTable from "@/components/registro-aplicacao/EntregasEnviadasTable";
import NovoRegistroAplicacaoModal from "@/components/registro-aplicacao/NovoRegistroAplicacaoModal";

const RegistroAplicacao: React.FC = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [caminhoesList, setCaminhoesList] = useState<any[]>([]);
  const [centrosCustoList, setCentrosCustoList] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<ListaProgramacaoEntrega | null>(null);
  const [filters, setFilters] = useState<RegistroAplicacaoFiltersType>({
    // Não definir data_inicio por padrão para mostrar todas as entregas
  });
  
  // Get user permissions and ID
  const { userId, isSuperAdmin } = useAuthPermissions();

  console.log("⚡️ RegistroAplicacao rendering - userId:", userId, "isSuperAdmin:", isSuperAdmin, "filters:", filters);

  const { 
    data: entregasEnviadas, 
    isLoading: isLoadingEntregas,
    refetch,
    error: entregasError
  } = useQuery({
    queryKey: ['entregasEnviadas', filters, userId, isSuperAdmin],
    queryFn: () => fetchEntregasEnviadas(filters.data_inicio, !isSuperAdmin ? userId || undefined : undefined),
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
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
    const defaultFilters = {};
    setFilters(defaultFilters);
  }, []);

  const handleEntregaSelect = useCallback((entrega: ListaProgramacaoEntrega) => {
    console.log("📋 Entrega selecionada:", entrega.logradouro);
    setSelectedEntrega(entrega);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEntrega(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    refetch();
    toast({
      title: "Sucesso",
      description: "Registro de aplicação salvo com sucesso!",
    });
  }, [refetch, toast]);

  const handleRefresh = useCallback(() => {
    console.log("🔄 Manual refresh triggered");
    refetch();
  }, [refetch]);

  // Check if there are active filters
  const hasActiveFilters = Boolean(
    filters.centro_custo_id || 
    filters.caminhao_id || 
    filters.data_inicio
  );

  console.log("📊 Query state:", {
    entregas: entregasEnviadas?.length || 0,
    isLoading: isLoadingEntregas,
    hasError: !!entregasError,
    hasActiveFilters
  });

  return (
    <MainLayout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Registro de Aplicação</h1>
            <p className="text-muted-foreground">Selecione uma entrega para registrar a aplicação</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Informações sobre filtros */}
          {!hasActiveFilters && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Dica:</strong> Sem filtros aplicados - mostrando todas as entregas disponíveis. 
                Use os filtros abaixo para refinar os resultados por data ou equipe.
              </AlertDescription>
            </Alert>
          )}

          <RegistroAplicacaoFilters 
            onFilter={handleFilter} 
            caminhoesList={caminhoesList}
            centrosCustoList={centrosCustoList}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />

          {/* Mostrar erro se houver */}
          {entregasError && (
            <Alert variant="destructive">
              <AlertDescription>
                Erro ao carregar entregas: {entregasError instanceof Error ? entregasError.message : 'Erro desconhecido'}
              </AlertDescription>
            </Alert>
          )}

          <EntregasEnviadasTable
            entregas={entregasEnviadas || []}
            isLoading={isLoadingEntregas}
            onEntregaSelect={handleEntregaSelect}
            onRefresh={handleRefresh}
          />
        </div>

        <NovoRegistroAplicacaoModal
          isOpen={isModalOpen}
          entrega={selectedEntrega}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      </div>
    </MainLayout>
  );
};

export default RegistroAplicacao;
