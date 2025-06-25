
import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import RegistroAplicacaoFilters from "@/components/registro-aplicacao/RegistroAplicacaoFilters";
import { Button } from "@/components/ui/button";
import { RefreshCw, Info, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchEntregasEnviadas } from "@/services/registro-aplicacao/fetchEntregasEnviadas";
import { RegistroAplicacaoFilters as RegistroAplicacaoFiltersType } from "@/types/registroAplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useUserDataAccess } from "@/hooks/useUserDataAccess";
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
  
  // Get user permissions and data access control
  const { userId, isSuperAdmin } = useAuthPermissions();
  const { allowedTeamIds, userRole, canAccessAllTeams, isLoading: accessLoading } = useUserDataAccess();

  console.log("⚡️ RegistroAplicacao rendering - userId:", userId, "userRole:", userRole, "allowedTeams:", allowedTeamIds, "filters:", filters);

  const { 
    data: entregasEnviadas, 
    isLoading: isLoadingEntregas,
    refetch,
    error: entregasError
  } = useQuery({
    queryKey: ['entregasEnviadas', filters, allowedTeamIds],
    queryFn: () => fetchEntregasEnviadas(filters, allowedTeamIds),
    enabled: !accessLoading && allowedTeamIds.length >= 0, // Allow empty array (no access)
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });

  // Load filter data - only once when component mounts and access data is ready
  useEffect(() => {
    const loadData = async () => {
      if (accessLoading || userId === null || isSuperAdmin === null) return;

      try {
        setIsLoading(true);
        console.log("🔄 Loading filter data - userId:", userId, "isSuperAdmin:", isSuperAdmin, "userRole:", userRole);
        
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

    loadData();
  }, [userId, isSuperAdmin, userRole, accessLoading, toast]);

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
    hasActiveFilters,
    allowedTeams: allowedTeamIds.length,
    canAccessAll: canAccessAllTeams
  });

  if (accessLoading) {
    return (
      <MainLayout>
        <div className="container py-6">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </MainLayout>
    );
  }

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
          {/* Security Status Alert */}
          <Alert className="bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="flex flex-col gap-1">
                <span>Usuário: <strong>{userRole}</strong></span>
                <span>Acesso: {canAccessAllTeams ? 'Todas as equipes' : `${allowedTeamIds.length} equipes permitidas`}</span>
                <span>Controle: <strong>Aplicado por equipe</strong> - Dados filtrados automaticamente</span>
              </div>
            </AlertDescription>
          </Alert>

          {/* No Access Warning */}
          {allowedTeamIds.length === 0 && !canAccessAllTeams && (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Sem Acesso a Equipes:</strong> Você não tem permissão para acessar nenhuma equipe. Entre em contato com o administrador para solicitar as permissões necessárias.
              </AlertDescription>
            </Alert>
          )}

          {/* Informações sobre filtros */}
          {!hasActiveFilters && allowedTeamIds.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Dica:</strong> Sem filtros aplicados - mostrando todas as entregas disponíveis para suas equipes. 
                Use os filtros abaixo para refinar os resultados por data ou centro de custo.
              </AlertDescription>
            </Alert>
          )}

          {(allowedTeamIds.length > 0 || canAccessAllTeams) && (
            <>
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
            </>
          )}
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
