/**
 * Modal de reabertura de Chamado Interno.
 * Substitui `window.prompt`. Motivo obrigatório após trim(). Mantém o modal
 * aberto em erro e preserva o texto digitado.
 */
import React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/chamados-internos/StatusBadges";
import type { ChamadoInternoStatus } from "@/types/chamadosInternos";

export interface ReabrirChamadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolo: string;
  titulo: string;
  status: ChamadoInternoStatus;
  isPending: boolean;
  onConfirm: (motivo: string) => Promise<void>;
}

export const ReabrirChamadoDialog: React.FC<ReabrirChamadoDialogProps> = ({
  open,
  onOpenChange,
  protocolo,
  titulo,
  status,
  isPending,
  onConfirm,
}) => {
  const [motivo, setMotivo] = React.useState("");

  React.useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const motivoTrim = motivo.trim();
  const podeConfirmar = motivoTrim.length > 0 && !isPending;

  const handleConfirm = async () => {
    if (!podeConfirmar) return;
    try {
      await onConfirm(motivoTrim);
    } catch {
      /* mantém aberto */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir chamado</DialogTitle>
          <DialogDescription>
            Informe o motivo da reabertura. Esta ação ficará registrada na
            timeline do chamado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <div>
              <span className="text-muted-foreground">Protocolo: </span>
              <span className="font-mono font-medium">{protocolo}</span>
            </div>
            <div className="mt-1">
              <span className="text-muted-foreground">Título: </span>
              <span className="font-medium">{titulo}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground">Status atual:</span>
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-reabertura">Motivo da reabertura</Label>
            <Textarea
              id="motivo-reabertura"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da reabertura..."
              rows={4}
              disabled={isPending}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={!podeConfirmar}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reabrindo...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reabrir chamado
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReabrirChamadoDialog;
