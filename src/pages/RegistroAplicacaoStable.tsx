import React, { useState, useCallback, useMemo } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import RegistroAplicacaoFilters from "@/components/registro-aplicacao/RegistroAplicacaoFilters";
import { Button } from "@/components/ui/button";
import { Plus, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchEntregasStable } from "@/services/registro-aplicacao/fetchEntregasStable";
import { RegistroAplicacaoFilters as RegistroAplicacaoFiltersType } from "@/types/registroAplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { usePermission } from "@/hooks/usePermission";
import { useUserDataAccessStable } from "@/hooks/useUserDataAccessStable";
import { fetchCentrosCustoFiltered } from "@/services/centrosCustoFilteredService";
import { fetchCaminhoesWithCapacity } from "@/services/caminhoesFilteredService";
import EntregasEnviadasTable from "@/components/registro-aplicacao/EntregasEnviadasTable";
import NovoRegistroAplicacaoModal from "@/components/registro-aplicacao/NovoRegistroAplicacaoModal";
import NovoRegistroManualModal from "@/components/registro-aplicacao/NovoRegistroManualModal";
import { useRegistrosManuais } from "@/hooks/registro-aplicacao/useRegistrosManuais";
import { useRegistroManualDrafts } from "@/hooks/registro-aplicacao/useRegistroManualDrafts";

const RegistroAplicacaoStable: React.FC = () => {
  usePageTitle("Registro de Aplicação");

  const [filters, setFilters] = useState<RegistroAplicacaoFiltersType>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<ListaProgramacaoEntrega | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDraftId, setManualDraftId] = useState<string | null>(null);

  const authData = usePermission();
  const teamAccess = useUserDataAccessStable(authData.userId, authData.userRole, authData.isSuperAdmin);

  const isReady = useMemo(
    () => !authData.isLoading && !teamAccess.isLoading,
    [authData.isLoading, teamAccess.isLoading]
  );

  const canLoadData = useMemo(
    () => isReady && (teamAccess.allowedTeamIds.length > 0 || teamAccess.canAccessAllTeams),
    [isReady, teamAccess.allowedTeamIds.length, teamAccess.canAccessAllTeams]
  );

  const {
    data: entregasEnviadas,
    isLoading: isLoadingEntregas,
    refetch,
    error: entregasError,
  } = useQuery({
    queryKey: ["entregasStable", filters, teamAccess.allowedTeamIds],
    queryFn: () => fetchEntregasStable(filters, teamAccess.allowedTeamIds),
    enabled: canLoadData,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: filterData } = useQuery({
    queryKey: ["filterData", authData.userId, authData.isSuperAdmin],
    queryFn: async () => {
      if (!authData.userId) return { caminhoes: [], centrosCusto: [] };
      const [caminhoes, centrosCusto] = await Promise.all([
        fetchCaminhoesWithCapacity(),
        fetchCentrosCustoFiltered(authData.userId, authData.isSuperAdmin),
      ]);
      return { caminhoes: caminhoes || [], centrosCusto: centrosCusto || [] };
    },
    enabled: isReady && !!authData.userId,
    staleTime: 10 * 60 * 1000,
  });

  const centroCustoById = useMemo(() => {
    const map: Record<string, { id: string; codigo_centro_custo?: string; nome_centro_custo?: string }> = {};
    (filterData?.centrosCusto || []).forEach((cc: any) => {
      if (cc?.id) {
        map[cc.id] = {
          id: cc.id,
          codigo_centro_custo: cc.codigo_centro_custo,
          nome_centro_custo: cc.nome_centro_custo,
        };
      }
    });
    return map;
  }, [filterData?.centrosCusto]);

  const registrosManuaisQ = useRegistrosManuais({
    centroCustoId: filters.centro_custo_id,
    dataInicio: filters.data_inicio,
    enabled: canLoadData,
  });

  const { drafts, removeDraft } = useRegistroManualDrafts();

  const rascunhosFiltrados = useMemo(() => {
    const dataIso = filters.data_inicio
      ? `${filters.data_inicio.getFullYear()}-${String(filters.data_inicio.getMonth() + 1).padStart(2, "0")}-${String(filters.data_inicio.getDate()).padStart(2, "0")}`
      : null;
    return drafts.filter((d) => {
      if (filters.centro_custo_id && d.centroCustoId !== filters.centro_custo_id) return false;
      if (dataIso && d.data && d.data !== dataIso) return false;
      return true;
    });
  }, [drafts, filters.centro_custo_id, filters.data_inicio]);

  const handleContinuarRascunho = useCallback((id: string) => {
    setManualDraftId(id);
    setIsManualModalOpen(true);
  }, []);

  const handleManualModalOpenChange = useCallback((v: boolean) => {
    setIsManualModalOpen(v);
    if (!v) setManualDraftId(null);
  }, []);

  const handleFilter = useCallback((newFilters: RegistroAplicacaoFiltersType) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const handleEntregaSelect = useCallback((entrega: ListaProgramacaoEntrega) => {
    setSelectedEntrega(entrega);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEntrega(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const hasActiveFilters = useMemo(
    () => Boolean(filters.centro_custo_id || filters.caminhao_id || filters.data_inicio),
    [filters]
  );

  if (authData.isLoading || teamAccess.isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex justify-center items-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-muted-foreground">Carregando permissões...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  const canCreateManual =
    Boolean(authData.isSuperAdmin) ||
    (typeof (authData as any).hasActionPermission === "function" &&
      (authData as any).hasActionPermission("requisicoes_registro_aplicacao_view", "criar"));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Registro de Aplicação</h1>
            <p className="text-sm text-muted-foreground">
              Fluxo logístico (entregas) e registro manual (tapa-buraco / pavimentação / fresagem).
            </p>
          </div>
          {canCreateManual && (
            <Button onClick={() => setIsManualModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Registro Manual
            </Button>
          )}
        </div>

        {!teamAccess.canAccessAllTeams && teamAccess.allowedTeamIds.length === 0 && (
          <Alert variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Sem Acesso:</strong> Você não tem permissão para acessar equipes.
              Contate o administrador.
            </AlertDescription>
          </Alert>
        )}

        {canLoadData && (
          <>
            <RegistroAplicacaoFilters
              onFilter={handleFilter}
              caminhoesList={filterData?.caminhoes || []}
              centrosCustoList={filterData?.centrosCusto || []}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
            />

            {entregasError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Erro ao carregar entregas:{" "}
                  {entregasError instanceof Error ? entregasError.message : "Erro desconhecido"}
                </AlertDescription>
              </Alert>
            )}

            <EntregasEnviadasTable
              entregas={entregasEnviadas || []}
              isLoading={isLoadingEntregas}
              onEntregaSelect={handleEntregaSelect}
              registrosManuais={registrosManuaisQ.data || []}
              rascunhos={rascunhosFiltrados}
              onContinuarRascunho={handleContinuarRascunho}
              onDescartarRascunho={removeDraft}
              statusFilter={filters.status}
              centroCustoById={centroCustoById}
            />
          </>
        )}

        <NovoRegistroAplicacaoModal
          isOpen={isModalOpen}
          entrega={selectedEntrega}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />

        <NovoRegistroManualModal
          open={isManualModalOpen}
          onOpenChange={handleManualModalOpenChange}
          centrosCusto={filterData?.centrosCusto || []}
          draftId={manualDraftId}
        />
      </div>
    </MainLayout>
  );
};

export default RegistroAplicacaoStable;
