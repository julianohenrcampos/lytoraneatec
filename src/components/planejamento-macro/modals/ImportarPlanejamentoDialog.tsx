// Fase 6F / 6H.1.1 — Modal de importação real de planejamento.
// Autorização: `canImport` (SuperAdm ou permissão engenharia_planejamento_macro_importar/criar). Backend é a autoridade final via RLS.

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UploadStep from "./importar/UploadStep";
import PreviewStep from "./importar/PreviewStep";
import { parseCronograma } from "@/lib/planejamentoMacro/importarCronograma/parseCronograma";
import { aplicarResolucaoFuncoes } from "@/lib/planejamentoMacro/importarCronograma/parseAlocacoes";
import { resolverFuncoesPorNomes } from "@/services/planejamentoMacro/recursosPlanejadosService";
import type {
  CentroCustoSelecionado,
  ResultadoParse,
} from "@/lib/planejamentoMacro/importarCronograma/tipos";
import { useImportarPlanejamentoObra } from "@/hooks/planejamentoMacro/useImportarPlanejamentoObra";
import { toast } from "sonner";

interface ImportarPlanejamentoDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cc: CentroCustoSelecionado | null;
  canImport: boolean;
}

const ImportarPlanejamentoDialog: React.FC<ImportarPlanejamentoDialogProps> = ({
  open,
  onOpenChange,
  cc,
  canImport,
}) => {
  const [parsing, setParsing] = React.useState(false);
  const [resultado, setResultado] = React.useState<ResultadoParse | null>(null);
  const importar = useImportarPlanejamentoObra();

  // Defesa em profundidade — autoridade final é a RLS no backend.
  if (!canImport || !cc) return null;

  const reset = () => {
    setResultado(null);
    setParsing(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop() ?? "";
      if (!["csv", "xlsx", "xls", "xml"].includes(ext)) {
        toast.error("Formato não suportado. Use .csv, .xlsx, .xls ou .xml.");
        return;
      }
      const r: ResultadoParse = await parseCronograma(file, cc);

      // 6H.1.1 — enriquecer com resolução de funções (não bloqueia em caso de falha)
      if (r.alocacoes.length > 0 && r.recursos) {
        try {
          const nomesUnicos = Array.from(
            new Set(
              r.alocacoes
                .filter(
                  (a) =>
                    (a.familia === "MOD" || a.familia === "MOI") &&
                    a.vinculoAtividadeLinha !== null &&
                    a.nomeRecurso
                )
                .map((a) => a.nomeRecurso as string)
            )
          );
          const funcoesMap = await resolverFuncoesPorNomes(nomesUnicos);
          aplicarResolucaoFuncoes(r.alocacoes, r.recursos, funcoesMap);
        } catch {
          toast.warning(
            "Não foi possível pré-resolver as funções para os recursos do cronograma. Eles aparecerão como não mapeados no preview."
          );
        }
      }

      setResultado(r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao ler o arquivo.";
      toast.error(msg);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!resultado) return;
    try {
      await importar.mutateAsync({ centro_custo_id: cc.id, resultado });
      onOpenChange(false);
      reset();
    } catch {
      // toast tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[1400px] max-h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Importar planejamento</DialogTitle>
          <DialogDescription>
            {resultado
              ? "Revise os dados extraídos. Nada é gravado antes de confirmar."
              : "Selecione um arquivo CSV ou Excel exportado do MS Project, Primavera ou planilha equivalente."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!resultado ? (
            <UploadStep cc={cc} parsing={parsing} onFileSelected={handleFile} />
          ) : (
            <PreviewStep
              cc={cc}
              resultado={resultado}
              submitting={importar.isPending}
              onCancel={() => handleClose(false)}
              onConfirm={handleConfirm}
              onTrocarArquivo={reset}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportarPlanejamentoDialog;
