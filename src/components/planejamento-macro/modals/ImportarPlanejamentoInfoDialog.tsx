// Fase 6E.1.2 — Dialog informativo (placeholder) para Importação de Cronograma.
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
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImportarPlanejamentoInfoDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importação de cronograma
          </DialogTitle>
          <DialogDescription>
            A importação de cronograma será disponibilizada na próxima fase. O
            planejamento real da obra deve nascer a partir do cronograma
            profissional; criação totalmente manual não é o fluxo recomendado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            O cronograma importado será vinculado ao Centro de Custo
            selecionado. Futuramente, a importação criará uma nova versão em
            rascunho para validação, sem sobrescrever automaticamente o
            planejamento vigente.
          </p>

          <div className="text-muted-foreground">
            <p className="mb-2">Formatos previstos:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>CSV / Excel</li>
              <li>MS Project (.mpp / XML)</li>
              <li>Primavera P6 (XER / XML)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportarPlanejamentoInfoDialog;
