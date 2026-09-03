/**
 * Central de Qualidade Cadastral — dashboard READ-ONLY de governança dos
 * cadastros mestres (CC, Funcionários, Veículos/Equipamentos, Funções).
 * Acesso exclusivo a SuperAdm (gate de rota + validação server-side nas RPCs).
 * Esta página nunca altera cadastros.
 */
import { useMemo, useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw } from "lucide-react";
import {
  useQualidadeResumo,
  useQualidadePendencias,
} from "@/hooks/qualidade-cadastral/useQualidadeCadastral";
import {
  buscarPendenciasParaExportacao,
  type QcFiltros,
  type QcPendencia,
} from "@/services/qualidadeCadastralService";
import { exportarPendenciasXlsx } from "@/services/excel/qualidadeCadastralExcel";
import type { QcDominio, QcTipo } from "@/lib/qualidade-cadastral/regras";
import QualidadeKpis from "@/components/qualidade-cadastral/QualidadeKpis";
import QualidadeFilters from "@/components/qualidade-cadastral/QualidadeFilters";
import QualidadeDominios from "@/components/qualidade-cadastral/QualidadeDominios";
import QualidadeCharts from "@/components/qualidade-cadastral/QualidadeCharts";
import QualidadeCentrosCusto from "@/components/qualidade-cadastral/QualidadeCentrosCusto";
import QualidadeResponsaveis from "@/components/qualidade-cadastral/QualidadeResponsaveis";
import QualidadeFrota from "@/components/qualidade-cadastral/QualidadeFrota";
import PendenciasTable from "@/components/qualidade-cadastral/PendenciasTable";
import PendenciaDrawer from "@/components/qualidade-cadastral/PendenciaDrawer";
import EstruturaResponsabilidade from "@/components/qualidade-cadastral/estrutura/EstruturaResponsabilidade";

export default function QualidadeCadastral() {
  usePageTitle("Central de Qualidade Cadastral");
  const { toast } = useToast();

  const [filtros, setFiltros] = useState<QcFiltros>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selecionada, setSelecionada] = useState<QcPendencia | null>(null);
  const [exportando, setExportando] = useState(false);

  const resumoQuery = useQualidadeResumo(filtros);
  const pendenciasQuery = useQualidadePendencias(filtros, page, pageSize);

  const aplicar = (patch: Partial<QcFiltros>) => {
    setFiltros((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const responsaveis = useMemo(
    () => (resumoQuery.data?.ranking_responsaveis ?? []).map((r) => r.responsavel).filter(Boolean),
    [resumoQuery.data],
  );

  const atualizadoEm = resumoQuery.data?.gerado_em
    ? new Date(resumoQuery.data.gerado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  const handleExportar = async () => {
    setExportando(true);
    try {
      const rows = await buscarPendenciasParaExportacao(filtros);
      if (rows.length === 0) {
        toast({ title: "Nada a exportar", description: "Nenhuma pendência nos filtros atuais." });
        return;
      }
      await exportarPendenciasXlsx(rows);
      toast({ title: "Exportação concluída", description: `${rows.length} pendência(s) exportada(s).` });
    } catch (e: any) {
      toast({
        title: "Falha na exportação",
        description: e?.message ?? "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Central de Qualidade Cadastral</h1>
          <p className="text-sm text-muted-foreground">
            Governança, integridade e atualização dos cadastros mestres do ERP
          </p>
          {atualizadoEm && (
            <p className="mt-1 text-xs text-muted-foreground">Atualizado em {atualizadoEm}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resumoQuery.refetch();
              pendenciasQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button size="sm" onClick={handleExportar} disabled={exportando}>
            <Download className="h-4 w-4 mr-2" />
            {exportando ? "Exportando..." : "Exportar pendências"}
          </Button>
        </div>
      </div>

      <QualidadeKpis
        resumo={resumoQuery.data}
        isLoading={resumoQuery.isLoading}
        onSelecionar={(acao) => {
          if (acao === "limpar") return setFiltros({});
          if (acao === "criticas") return aplicar({ severidade: "CRITICA" });
          if (acao === "duplicidades") return aplicar({ tipo: "POSSIVEL_DUPLICIDADE" });
          if (acao === "desatualizados") return aplicar({ tipo: "DESATUALIZADO" });
          if (acao === "sem_responsavel") return aplicar({ sem_responsavel: true });
          if (acao === "pendentes") return aplicar({ severidade: undefined, tipo: undefined });
        }}
      />

      <QualidadeFilters filtros={filtros} onChange={(f) => { setFiltros(f); setPage(1); }} responsaveis={responsaveis} />

      <QualidadeDominios
        resumo={resumoQuery.data}
        isLoading={resumoQuery.isLoading}
        dominioAtivo={filtros.dominio as QcDominio | undefined}
        onSelecionar={(d) => aplicar({ dominio: filtros.dominio === d ? undefined : d })}
      />

      <QualidadeCharts
        resumo={resumoQuery.data}
        isLoading={resumoQuery.isLoading}
        onFiltrarTipo={(t: QcTipo) => aplicar({ tipo: t })}
        onFiltrarDominio={(d) => aplicar({ dominio: d })}
      />

      <EstruturaResponsabilidade filtros={filtros} onAplicarFiltros={aplicar} />

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">

        <QualidadeCentrosCusto
          resumo={resumoQuery.data}
          isLoading={resumoQuery.isLoading}
          onSelecionar={(ccId) => aplicar({ centro_custo_id: ccId })}
        />
        <QualidadeResponsaveis
          resumo={resumoQuery.data}
          isLoading={resumoQuery.isLoading}
          onSelecionar={(r) => aplicar({ responsavel: r, sem_responsavel: undefined })}
          onSelecionarSemResponsavel={() => aplicar({ sem_responsavel: true, responsavel: undefined })}
        />
      </div>

      <QualidadeFrota
        resumo={resumoQuery.data}
        isLoading={resumoQuery.isLoading}
        onFiltrarFrotaDesatualizada={(dias) =>
          aplicar({ dominio: "VEICULO_EQUIPAMENTO", dias_min: dias > 0 ? dias : undefined })
        }
      />

      <PendenciasTable
        rows={pendenciasQuery.data?.rows ?? []}
        total={pendenciasQuery.data?.total ?? 0}
        page={page}
        pageSize={pageSize}
        isLoading={pendenciasQuery.isLoading}
        isError={pendenciasQuery.isError}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        onSelecionar={setSelecionada}
        onRetry={() => pendenciasQuery.refetch()}
      />

      <PendenciaDrawer pendencia={selecionada} onClose={() => setSelecionada(null)} />
    </div>
  );
}
