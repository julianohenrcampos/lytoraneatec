import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Gavel, ArrowLeft, Settings, Building2, BarChart3, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { fetchContratacoes, syncContratacoes, getLastSyncStatus, deleteContratacao, deleteMultipleContratacoes, getEncerradasCount, deleteEncerradas, toggleParticipando, toggleDescartada } from "@/services/pncpService";
import { PNCPFilters as PNCPFiltersType, PNCPSyncResult } from "@/types/pncp";
import { PNCPTable } from "@/components/pncp/PNCPTable";
import { PNCPFilters } from "@/components/pncp/PNCPFilters";
import { PNCPMobileCards } from "@/components/pncp/PNCPMobileCards";
import { PNCPSyncStatus } from "@/components/pncp/PNCPSyncStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { useConfiguracaoSistema, useUpdateConfiguracao } from "@/hooks/useConfiguracaoSistema";
export default function MonitoramentoPNCP() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PNCPFiltersType>({ ocultarEncerradas: false, ordenacao: 'prazo' });
  const [salvarTodas, setSalvarTodas] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<PNCPSyncResult | null>(null);
  const modoEngQuery = useConfiguracaoSistema('modo_engenharia_licitacoes');
  const updateConfig = useUpdateConfiguracao();
  const modoEngenharia = modoEngQuery.data === 'true';
  const {
    data: contratacoes,
    isLoading,
    error
  } = useQuery({
    queryKey: ["pncp-contratacoes", filters],
    queryFn: () => fetchContratacoes(filters)
  });
  const {
    data: lastSync,
    refetch: refetchSync
  } = useQuery({
    queryKey: ["pncp-last-sync"],
    queryFn: getLastSyncStatus
  });
  const syncMutation = useMutation({
    mutationFn: (salvarTodas: boolean) => syncContratacoes(salvarTodas),
    onSuccess: data => {
      setLastSyncResult(data);
      const orgInfo = data.total_orgaos_classificados != null 
        ? ` | 🏢 ${data.total_orgaos_classificados} classificados, ⚠️ ${data.total_orgaos_pendentes} pendentes`
        : '';
      toast.success(`Sincronização concluída!`, {
        description: `${data.total_inseridos} novas licitações encontradas.${orgInfo}`
      });
      queryClient.invalidateQueries({
        queryKey: ["pncp-contratacoes"]
      });
      refetchSync();
    },
    onError: (error: any) => {
      const msg = error?.message || error?.context?.body?.message || "Erro desconhecido";
      toast.error("Erro na sincronização", { description: msg });
      console.error("Sync error:", error);
      refetchSync();
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteContratacao,
    onSuccess: () => {
      toast.success("Licitação excluída com sucesso");
      queryClient.invalidateQueries({
        queryKey: ["pncp-contratacoes"]
      });
    },
    onError: () => {
      toast.error("Erro ao excluir licitação");
    }
  });
  const deleteMultipleMutation = useMutation({
    mutationFn: deleteMultipleContratacoes,
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} licitações excluídas com sucesso`);
      queryClient.invalidateQueries({
        queryKey: ["pncp-contratacoes"]
      });
    },
    onError: () => {
      toast.error("Erro ao excluir licitações");
    }
  });
  const {
    data: encerradasCount = 0
  } = useQuery({
    queryKey: ["pncp-encerradas-count"],
    queryFn: getEncerradasCount
  });
  const deleteEncerradasMutation = useMutation({
    mutationFn: deleteEncerradas,
    onSuccess: count => {
      toast.success(`${count} licitações encerradas excluídas`);
      queryClient.invalidateQueries({
        queryKey: ["pncp-contratacoes"]
      });
      queryClient.invalidateQueries({
        queryKey: ["pncp-encerradas-count"]
      });
    },
    onError: () => {
      toast.error("Erro ao excluir licitações encerradas");
    }
  });
  const handleSync = () => {
    toast.loading(salvarTodas ? "Sincronizando e salvando TODAS as licitações..." : "Sincronizando com PNCP...", {
      id: "pncp-sync"
    });
    syncMutation.mutate(salvarTodas, {
      onSettled: () => toast.dismiss("pncp-sync")
    });
  };
  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };
  const handleDeleteMultiple = (ids: string[]) => {
    deleteMultipleMutation.mutate(ids);
  };
  const toggleParticipandoMutation = useMutation({
    mutationFn: ({
      id,
      participando
    }: {
      id: string;
      participando: boolean;
    }) => toggleParticipando(id, participando),
    onSuccess: (_, {
      participando
    }) => {
      toast.success(participando ? "Marcado como participando" : "Desmarcado participando");
      queryClient.invalidateQueries({
        queryKey: ["pncp-contratacoes"]
      });
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    }
  });
  const handleToggleParticipando = (id: string, participando: boolean) => {
    toggleParticipandoMutation.mutate({
      id,
      participando
    });
  };
  const toggleDescartadaMutation = useMutation({
    mutationFn: ({
      id,
      descartada
    }: {
      id: string;
      descartada: boolean;
    }) => toggleDescartada(id, descartada),
    onSuccess: (_, {
      descartada
    }) => {
      toast.success(descartada ? "Licitação descartada" : "Licitação reativada");
      queryClient.invalidateQueries({
        queryKey: ["pncp-contratacoes"]
      });
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    }
  });
  const handleToggleDescartada = (id: string, descartada: boolean) => {
    toggleDescartadaMutation.mutate({
      id,
      descartada
    });
  };
  if (error) {
    return <div className="container mx-auto py-6 px-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Erro ao carregar</CardTitle>
            <CardDescription>Verifique suas permissões.</CardDescription>
          </CardHeader>
        </Card>
      </div>;
  }
  return <MainLayout>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Gavel className="h-7 w-7 text-primary" />
              Monitoramento de Licitações - PNCP
            </h1>
            <p className="text-muted-foreground mt-1">
              Licitações públicas de obras - configuração dinâmica
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap items-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                  <Brain className="h-4 w-4 text-primary" />
                  <Label htmlFor="modo-eng" className="text-sm whitespace-nowrap cursor-pointer">
                    Modo Engenharia
                  </Label>
                  <Switch 
                    id="modo-eng"
                    checked={modoEngenharia}
                    onCheckedChange={(checked) => {
                      updateConfig.mutate({ chave: 'modo_engenharia_licitacoes', valor: checked ? 'true' : 'false' });
                    }}
                    disabled={updateConfig.isPending}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Matching inteligente por sinônimos técnicos (ex: "serviços hidráulicos" → drenagem)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
                  <Label htmlFor="salvar-todas" className="text-sm whitespace-nowrap cursor-pointer">
                    Salvar Todas
                  </Label>
                  <Switch 
                    id="salvar-todas"
                    checked={salvarTodas}
                    onCheckedChange={setSalvarTodas}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Salvar todas as licitações analisadas, não apenas as que fazem match</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="outline" onClick={() => navigate("/licitacoes/dashboard")}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </Button>

          <Button variant="outline" onClick={() => navigate("/licitacoes/orgaos-pendentes")}>
            <Building2 className="h-4 w-4 mr-2" />
            Órgãos Pendentes
          </Button>

          <Button variant="outline" onClick={() => navigate("/licitacoes/configuracoes-matching")}>
            <Brain className="h-4 w-4 mr-2" />
            Calibração
          </Button>

          <Button variant="outline" onClick={() => navigate("/licitacoes/configuracoes-pncp")}>
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          
          {encerradasCount > 0}
          
          <Button onClick={handleSync} disabled={syncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      <PNCPSyncStatus lastSync={lastSync} isSyncing={syncMutation.isPending} lastSyncResult={lastSyncResult} />

      <PNCPFilters filters={filters} onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))} onClearFilters={() => setFilters({ ocultarEncerradas: filters.ocultarEncerradas })} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Licitações Encontradas</CardTitle>
          <CardDescription>
            {isLoading ? "Carregando..." : `${contratacoes?.length || 0} licitação(ões)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div> : contratacoes && contratacoes.length > 0 ? isMobile ? <PNCPMobileCards contratacoes={contratacoes} onDelete={handleDelete} onDeleteMultiple={handleDeleteMultiple} onToggleDescartada={handleToggleDescartada} /> : <PNCPTable contratacoes={contratacoes} onDelete={handleDelete} onDeleteMultiple={handleDeleteMultiple} onToggleParticipando={handleToggleParticipando} onToggleDescartada={handleToggleDescartada} /> : <div className="text-center py-12 text-muted-foreground">
              <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma licitação encontrada</p>
              <p className="text-sm mt-1">Clique em "Sincronizar" para buscar do PNCP</p>
            </div>}
        </CardContent>
      </Card>
      </div>
    </MainLayout>;
}