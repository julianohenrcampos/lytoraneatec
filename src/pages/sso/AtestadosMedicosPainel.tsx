// Fase 2-A — Painel interno de Atestados Médicos.
// Rota protegida por Secure permission="saude_atestados_view".
// Consulta somente bd_atestados_medicos, sem joins.
// Abas: Listagem (tabela atual) e Dashboard (KPIs, gráficos, alertas, exportação Excel).

import { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useHasPermission } from "@/hooks/usePermission";
import { useAtestadosPainel } from "@/hooks/atestados/useAtestadosPainel";
import { useMarcarAtestadoLido } from "@/hooks/atestados/useMarcarAtestadoLido";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AtestadosFilters from "@/components/atestados/painel/AtestadosFilters";
import AtestadosTable from "@/components/atestados/painel/AtestadosTable";
import AtestadoDetailModal from "@/components/atestados/painel/AtestadoDetailModal";
import AtestadosDashboard from "@/components/atestados/painel/AtestadosDashboard";
import type {
  AtestadoRow,
  AtestadosPainelFilters,
} from "@/types/atestadoMedico";

export default function AtestadosMedicosPainel() {
  usePageTitle("Atestados Médicos");
  const canDownload = useHasPermission("saude_atestados_download");
  const canAnalisar = useHasPermission("saude_atestados_analisar");
  const canStatusUpdate = useHasPermission("saude_atestados_status_update");
  const canMarcarLido = canAnalisar || canStatusUpdate;
  const marcarLido = useMarcarAtestadoLido();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<AtestadosPainelFilters>({
    prazo: "todos",
  });
  const { data, isLoading } = useAtestadosPainel(filters);
  const [selected, setSelected] = useState<AtestadoRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"dados" | "arquivo">("dados");

  const pagination = usePagination(data ?? [], { pageSize: 20 });

  // Volta para a primeira página sempre que os filtros mudarem.
  useEffect(() => {
    pagination.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const abrirDetalhe = (r: AtestadoRow) => {
    setSelected(r);
    setInitialTab("dados");
    setModalOpen(true);
  };

  return (
    <MainLayout>
      <Tabs defaultValue="listagem" className="space-y-4">
        <TabsList>
          <TabsTrigger value="listagem">Listagem</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <AtestadosFilters value={filters} onChange={setFilters} />

        <TabsContent value="listagem" className="space-y-4 mt-0">
          <AtestadosTable
            rows={pagination.paginatedData}
            isLoading={isLoading}
            canDownload={canDownload}
            canMarcarLido={canMarcarLido}
            togglingId={togglingId}
            onToggleLido={(r, lido) => {
              setTogglingId(r.id);
              marcarLido.mutate(
                { id: r.id, lido },
                { onSettled: () => setTogglingId(null) },
              );
            }}
            onVer={abrirDetalhe}
            onAbrirArquivo={(r) => {
              setSelected(r);
              setInitialTab("arquivo");
              setModalOpen(true);
            }}
          />
          {!isLoading && <TablePagination pagination={pagination} />}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-0">
          <AtestadosDashboard
            rows={data ?? []}
            filters={filters}
            isLoading={isLoading}
            onVer={abrirDetalhe}
            onFiltersChange={setFilters}
          />
        </TabsContent>
      </Tabs>

      <AtestadoDetailModal
        row={selected}
        open={modalOpen}
        onOpenChange={setModalOpen}
        canDownload={canDownload}
        initialTab={initialTab}
      />
    </MainLayout>
  );
}
