/**
 * Dropdown de exportação do Relatório AP's — B.3.5-E4-A + E4-B.
 * Excel: sempre disponível quando há linhas.
 * PDF Prefeitura: gerado in-memory (jsPDF), captura mapa via ref.
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RelatorioApsState } from "@/types/relatorioAps";
import { gerarRelatorioApsExcel } from "@/services/excel/relatorioApsExcel";
import { gerarRelatorioApsPdf } from "@/services/pdf/relatorioApsPdf";
import type { RelatorioApsMapaHandle } from "./RelatorioApsMapa";

interface Props {
  state: RelatorioApsState;
  mapaRef?: React.RefObject<RelatorioApsMapaHandle | null>;
}

const RelatorioApsExportDropdown: React.FC<Props> = ({ state, mapaRef }) => {
  const { toast } = useToast();
  const [gerando, setGerando] = useState<"excel" | "pdf" | null>(null);
  const disabled = state.linhas.length === 0;

  const handleExcel = async () => {
    setGerando("excel");
    try {
      await gerarRelatorioApsExcel(state);
      toast({ title: "Excel gerado", description: "Arquivo baixado com sucesso." });
    } catch (e) {
      console.error("[RELATORIO_APS][EXCEL_FAIL]", e);
      toast({
        title: "Erro ao gerar Excel",
        description: (e as Error)?.message || "Falha desconhecida.",
        variant: "destructive",
      });
    } finally {
      setGerando(null);
    }
  };

  const handlePdf = async () => {
    setGerando("pdf");
    try {
      const mapaDataUrl =
        (await mapaRef?.current?.capturarPngDataUrl({
          incluirPontosRua: state.mapa.incluirPontosRuaNoPdf,
        })) ?? null;
      await gerarRelatorioApsPdf({ state, mapaDataUrl });
      toast({ title: "PDF gerado", description: "Arquivo baixado com sucesso." });
    } catch (e) {
      console.error("[RELATORIO_APS][PDF_FAIL]", e);
      toast({
        title: "Erro ao gerar PDF",
        description: (e as Error)?.message || "Falha desconhecida.",
        variant: "destructive",
      });
    } finally {
      setGerando(null);
    }
  };

  const trigger = (
    <Button variant="default" size="sm" disabled={disabled} className="gap-1">
      <Download className="h-4 w-4" />
      Exportar
      <ChevronDown className="h-4 w-4 opacity-70" />
    </Button>
  );

  return (
    <TooltipProvider>
      <DropdownMenu>
        {disabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{trigger}</span>
            </TooltipTrigger>
            <TooltipContent>Monte o relatório antes de exportar.</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        )}
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={handleExcel} disabled={gerando !== null}>
            {gerando === "excel" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Excel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handlePdf} disabled={gerando !== null}>
            {gerando === "pdf" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            PDF Prefeitura
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
};

export default RelatorioApsExportDropdown;
