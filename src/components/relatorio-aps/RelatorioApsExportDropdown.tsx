/**
 * Dropdown de exportação do Relatório AP's — Excel, PDF Prefeitura e PowerPoint.
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
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RelatorioApsState } from "@/types/relatorioAps";
import { gerarRelatorioApsExcel } from "@/services/excel/relatorioApsExcel";
import { gerarRelatorioApsPdf } from "@/services/pdf/relatorioApsPdf";
import type { RelatorioApsMapaHandle } from "./RelatorioApsMapa";

interface Props {
  state: RelatorioApsState;
  mapaRef?: React.RefObject<RelatorioApsMapaHandle | null>;
  /** Código real do Centro de Custo selecionado (obrigatório para o Excel). */
  centroCustoCodigo: string;
}

type Gerando = "excel" | "pdf" | "pptx" | null;

const RelatorioApsExportDropdown: React.FC<Props> = ({
  state,
  mapaRef,
  centroCustoCodigo,
}) => {
  const { toast } = useToast();
  const [gerando, setGerando] = useState<Gerando>(null);
  const disabled = state.linhas.length === 0;
  const emAndamento = gerando !== null;

  const handleExcel = async () => {
    setGerando("excel");
    try {
      await gerarRelatorioApsExcel({ state, centroCustoCodigo });
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

  const handlePptx = async () => {
    if (state.linhas.length === 0) {
      toast({
        title: "Nada para exportar",
        description: "Monte o relatório antes de exportar.",
        variant: "destructive",
      });
      return;
    }
    setGerando("pptx");
    try {
      const mapaDataUrl =
        (await mapaRef?.current?.capturarPngDataUrl({
          incluirPontosRua: state.mapa.incluirPontosRuaNoPdf,
        })) ?? null;
      const { gerarRelatorioApsPptx } = await import(
        "@/services/pptx/relatorioApsPptx"
      );
      await gerarRelatorioApsPptx({ state, mapaDataUrl });
      toast({
        title: "PowerPoint gerado",
        description: "Arquivo baixado com sucesso.",
      });
    } catch (e) {
      console.error("[RELATORIO_APS][PPTX_FAIL]", e);
      toast({
        title: "Erro ao gerar PowerPoint",
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
          <DropdownMenuItem onSelect={handleExcel} disabled={emAndamento}>
            {gerando === "excel" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            Excel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handlePdf} disabled={emAndamento}>
            {gerando === "pdf" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            PDF Prefeitura
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handlePptx} disabled={emAndamento}>
            {gerando === "pptx" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Presentation className="h-4 w-4 mr-2" />
            )}
            PowerPoint (.pptx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
};

export default RelatorioApsExportDropdown;
