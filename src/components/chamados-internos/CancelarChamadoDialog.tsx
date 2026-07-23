/**
 * Modal de cancelamento de Chamado Interno.
 *
 * Substitui integralmente `window.prompt`. Segue o padrão visual do ERP
 * (Dialog + Textarea + Button destrutivo). Não fecha em erro de validação
 * nem em erro da RPC — preserva o motivo digitado.
 */
import React from "react";
import { Loader2, XCircle } from "lucide-react";
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
import type {
  ChamadoInternoStatus,
} from "@/types/chamadosInternos";

export interface CancelarChamadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolo: string;
  titulo: string;
  status: ChamadoInternoStatus;
  isPending: boolean;
  /** Executa a RPC de cancelamento. Deve `throw` em erro para manter o modal aberto. */
  onConfirm: (motivo: string) => Promise<void>;
}

export const CancelarChamadoDialog: React.FC<CancelarChamadoDialogProps> = ({
  open,
  onOpenChange,
  protocolo,
  titulo,
  status,
  isPending,
  onConfirm,
}) => {
  const [motivo, setMotivo] = React.useState("");

  // Reset ao abrir novamente.
  React.useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const motivoTrim = motivo.trim();
  const podeConfirmar = motivoTrim.length > 0 && !isPending;

  const handleConfirm = async () => {
    if (!podeConfirmar) return;
    try {
      await onConfirm(motivoTrim);
      // Sucesso → o pai fecha o modal.
    } catch {
      // Preserva o texto digitado e mantém o modal aberto.
      // O toast de erro é responsabilidade do pai.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Bloqueia fechamento durante a mutation.
        if (isPending && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar chamado</DialogTitle>
          <DialogDescription>
            Informe o motivo do cancelamento. Esta ação ficará registrada
            na timeline do chamado.
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
            <Label htmlFor="motivo-cancelamento">Motivo do cancelamento</Label>
            <Textarea
              id="motivo-cancelamento"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
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
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!podeConfirmar}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar chamado
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelarChamadoDialog;
