// Fase 2-A — Painel interno de Atestados Médicos.
// Rota protegida por Secure permission="saude_atestados_view".
// Consulta somente bd_atestados_medicos, sem joins.

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useHasPermission } from "@/hooks/usePermission";
import { useAtestadosPainel } from "@/hooks/atestados/useAtestadosPainel";
import { useAtestadoArquivoAssinado } from "@/hooks/atestados/useAtestadoArquivoAssinado";
import AtestadosFilters from "@/components/atestados/painel/AtestadosFilters";
import AtestadosTable from "@/components/atestados/painel/AtestadosTable";
import AtestadoDetailModal from "@/components/atestados/painel/AtestadoDetailModal";
import type {
  AtestadoRow,
  AtestadosPainelFilters,
} from "@/types/atestadoMedico";

export default function AtestadosMedicosPainel() {
  usePageTitle("Atestados Médicos");
  const canDownload = useHasPermission("saude_atestados_download");
  const [filters, setFilters] = useState<AtestadosPainelFilters>({
    prazo: "todos",
  });
  const { data, isLoading } = useAtestadosPainel(filters);
  const [selected, setSelected] = useState<AtestadoRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { abrir, loadingId } = useAtestadoArquivoAssinado();

  return (
    <MainLayout>
      <div className="space-y-4">
        <AtestadosFilters value={filters} onChange={setFilters} />
        <AtestadosTable
          rows={data ?? []}
          isLoading={isLoading}
          canDownload={canDownload}
          onVer={(r) => {
            setSelected(r);
            setModalOpen(true);
          }}
          onAbrirArquivo={(r) => abrir(r.id)}
          arquivoLoadingId={loadingId}
        />
        <AtestadoDetailModal
          row={selected}
          open={modalOpen}
          onOpenChange={setModalOpen}
          canDownload={canDownload}
          onAbrirArquivo={(r) => abrir(r.id)}
          arquivoLoading={!!selected && loadingId === selected.id}
        />
      </div>
    </MainLayout>
  );
}
