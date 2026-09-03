import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText } from "lucide-react";
import { useRelatorioApsState } from "@/hooks/relatorio-aps/useRelatorioApsState";
import RelatorioApsBuilderContent from "./RelatorioApsBuilderContent";

interface Props {
  registroAplicacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wrapper Dialog do Relatório AP's — fluxo por registro individual (E1/E2).
 * O conteúdo agora vive em RelatorioApsBuilderContent, reutilizado também
 * pela aba "Relatório AP's" em /relatorio-aplicacao-diaria (E3.1).
 */
const RelatorioApsBuilder: React.FC<Props> = ({ registroAplicacaoId, open, onOpenChange }) => {
  const ctrl = useRelatorioApsState(open ? registroAplicacaoId : null);
  const idCurto = ctrl.state.registroId ? ctrl.state.registroId.slice(0, 8) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Relatório AP's
          </DialogTitle>
          {ctrl.state.registroId && (
            <DialogDescription>
              Registro <span className="font-mono">{idCurto}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <RelatorioApsBuilderContent ctrl={ctrl} />

        <DialogFooter className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex w-full">
                  <Button variant="outline" disabled className="w-full">
                    Gerar PDF
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponível na próxima fase</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RelatorioApsBuilder;
