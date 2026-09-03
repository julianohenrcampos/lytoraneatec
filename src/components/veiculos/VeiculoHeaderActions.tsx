
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronDown, FolderPlus, FileDown, FileUp, Download, ShieldAlert, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  carregarListasReferenciaV3,
  calcularArquivoSha256LogicoV3,
  gerarWorkbookV3Simplificado,
  bytesToXlsxBlob,
} from "@/services/veiculo/importV3";

interface VeiculoHeaderActionsProps {
  onNewClick: () => void;
  onExport: () => void;
  onImport: () => void;
  onImportV2DryRun?: () => void;
  onManageCategorias: () => void;
  onManageSubcategorias: () => void;
  onManageFrotas: () => void;
  onManageLinhasOperacionais: () => void;
  canExport?: boolean;
}

const VeiculoHeaderActions: React.FC<VeiculoHeaderActionsProps> = ({
  onNewClick,
  onExport,
  onImport,
  onImportV2DryRun,
  onManageCategorias,
  onManageSubcategorias,
  onManageFrotas,
  onManageLinhasOperacionais,
  canExport = true,
}) => {
  const { toast } = useToast();
  const [baixandoModelo, setBaixandoModelo] = useState(false);

  const baixarArquivo = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const baixarModeloSimplificado = async () => {
    if (baixandoModelo) return;
    setBaixandoModelo(true);
    try {
      toast({ title: "Preparando modelo…", description: "Carregando catálogos oficiais." });
      const listas = await carregarListasReferenciaV3({ modo: 'MODELO' });
      const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'MODELO', linhas: [] });
      const bytes = await gerarWorkbookV3Simplificado({
        tipo_arquivo: 'MODELO',
        listas,
        registros: [],
        arquivo_sha256_logico: sha,
        gerado_por: 'ui.header_actions',
        observacoes: 'Modelo oficial V3 simplificado — 20 colunas visíveis + 1 técnica oculta.',
      });
      const blob = bytesToXlsxBlob(bytes);
      if (blob.size === 0) {
        throw new Error("O gerador retornou um arquivo vazio.");
      }
      const stamp = new Date().toISOString().slice(0, 10);
      baixarArquivo(blob, `modelo_importacao_equipamentos_v3_${stamp}.xlsx`);
      toast({ title: "Modelo pronto", description: "Arquivo baixado com listas atualizadas." });
    } catch (err) {
      console.error("[Importador V3] Falha ao baixar modelo:", err);
      toast({
        title: "Falha ao gerar modelo",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBaixandoModelo(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onNewClick} className="whitespace-nowrap">
        <Plus className="mr-2 h-4 w-4" />
        Novo C/E
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            <FolderPlus className="mr-2 h-4 w-4" />
            Cadastros
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover">
          <DropdownMenuItem onClick={onManageCategorias}>Categoria</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageSubcategorias}>Subcategoria</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageFrotas}>Frota</DropdownMenuItem>
          <DropdownMenuItem onClick={onManageLinhasOperacionais}>Linha Operacional</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="whitespace-nowrap">
            <FileDown className="mr-2 h-4 w-4" />
            Dados
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover w-[340px]">
          <DropdownMenuItem
            disabled={baixandoModelo}
            onSelect={(event) => {
              event.preventDefault();
              void baixarModeloSimplificado();
            }}
            className="flex-col items-start gap-0.5 py-2"
          >
            <div className="flex items-center w-full">
              {baixandoModelo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              <span className="font-medium">{baixandoModelo ? "Gerando modelo…" : "Baixar Modelo (V3)"}</span>
            </div>
            <span className="text-[11px] text-muted-foreground pl-6 leading-snug">
              Para <strong>cadastrar novos ativos</strong>. Ativos já existentes são bloqueados e devem ser editados via Exportação.
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onExport} disabled={!canExport} className="flex-col items-start gap-0.5 py-2">
            <div className="flex items-center w-full">
              <FileDown className="mr-2 h-4 w-4" />
              <span className="font-medium">Exportar (V3)</span>
            </div>
            <span className="text-[11px] text-muted-foreground pl-6 leading-snug">
              Para <strong>editar ativos existentes</strong> (inclui Centro de Custo). Traz o snapshot atual.
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImport}>
            <FileUp className="mr-2 h-4 w-4" />
            Importar (V3)
          </DropdownMenuItem>
          {onImportV2DryRun && (
            <DropdownMenuItem onClick={onImportV2DryRun} className="flex items-center justify-between gap-4">
              <span className="flex items-center">
                <ShieldAlert className="mr-2 h-4 w-4" />
                Importador V2 — Dry-Run
              </span>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Legado</Badge>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default VeiculoHeaderActions;
