import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { AtestadoRow, AtestadosPainelFilters } from "@/types/atestadoMedico";
import { exportarAtestadosExcel } from "@/services/excel/atestadosExcel";
import AtestadosDashboardCards from "./AtestadosDashboardCards";
import AtestadosDashboardCharts from "./AtestadosDashboardCharts";
import AtestadosDashboardCC from "./AtestadosDashboardCC";
import AtestadosDashboardAlertas from "./AtestadosDashboardAlertas";

interface Props {
  rows: AtestadoRow[];
  filters: AtestadosPainelFilters;
  isLoading: boolean;
  onVer: (row: AtestadoRow) => void;
  onFiltersChange: (filters: AtestadosPainelFilters) => void;
}

/** Limite de segurança alinhado ao .limit(500) da query do painel. */
const LIMITE_EXPORTACAO = 500;

export default function AtestadosDashboard({ rows, filters, isLoading, onVer, onFiltersChange }: Props) {
  const [exportando, setExportando] = useState(false);

  const handleExportar = async () => {
    if (rows.length >= LIMITE_EXPORTACAO) {
      toast.warning("Reduza os filtros para exportar.", {
        description: `O conjunto atual atingiu o limite de ${LIMITE_EXPORTACAO} registros.`,
      });
      return;
    }
    setExportando(true);
    try {
      await exportarAtestadosExcel(rows, filters);
      toast.success("Exportação concluída", {
        description: `${rows.length} registro(s) exportados.`,
      });
    } catch {
      toast.error("Não foi possível gerar o arquivo Excel.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportar}
          disabled={exportando || isLoading || rows.length === 0}
          className="gap-2"
        >
          {exportando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          Exportar Excel
        </Button>
      </div>
      <AtestadosDashboardCards rows={rows} />
      <AtestadosDashboardCharts rows={rows} />
      <AtestadosDashboardCC rows={rows} filters={filters} onFiltersChange={onFiltersChange} />
      <AtestadosDashboardAlertas rows={rows} onVer={onVer} />
    </div>
  );
}
