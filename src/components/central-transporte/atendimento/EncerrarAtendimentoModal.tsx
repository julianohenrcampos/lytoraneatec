/**
 * CT-2 / M4 — Modal de encerramento (CANCELADO / LIBERADO).
 * NÃO depende de candidato selecionado nem de contadores.pendentes.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { encerrarAtendimento } from "@/services/centralTransporteAtendimentoService";
import {
  CT_TEXTO_MIN,
  type CtAtendimento,
  type CtEncerramentoStatus,
} from "@/types/centralTransporteCT2";
import type { CtOperationApi } from "@/hooks/central-transporte/useCtOperation";

interface Props {
  open: boolean;
  onClose: () => void;
  atendimento: CtAtendimento;
  ctOperation: CtOperationApi;
  onSuccess: () => void;
}

const EncerrarAtendimentoModal: React.FC<Props> = ({
  open,
  onClose,
  atendimento,
  ctOperation,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [novoStatus, setNovoStatus] = useState<CtEncerramentoStatus>("CANCELADO");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const materialKey = JSON.stringify(["ENCERRAR", atendimento.id, novoStatus, motivo.trim()]);
  const uncertainAttempt = ctOperation.getAttempt(materialKey)?.state === "UNCERTAIN";
  const bloqueadoPorConflito = ctOperation.isBlocked(
    [atendimento.id, atendimento.solicitacao_item_id],
    materialKey,
  );

  const motivoValido = motivo.trim().length >= CT_TEXTO_MIN;

  const handleSubmit = async () => {
    setSubmitting(true);
    const outcome = await ctOperation.run({
      operation: "ENCERRAR",
      materialKey,
      resourceIds: [atendimento.id, atendimento.solicitacao_item_id, atendimento.equipamento_id],
      exec: (requestId) =>
        encerrarAtendimento({
          atendimentoId: atendimento.id,
          novoStatus,
          motivo: motivo.trim(),
          requestId,
        }),
    });
    setSubmitting(false);

    if (outcome.status === "ok") {
      toast({
        title: outcome.replay ? "Operação já registrada" : "Atendimento encerrado",
        description: outcome.replay
          ? "Esta operação já havia sido processada — nenhum registro duplicado foi criado."
          : `Atendimento marcado como ${novoStatus.toLowerCase()}.`,
      });
      onSuccess();
      onClose();
      return;
    }

    toast({
      title: outcome.status === "uncertain" ? "Resultado não confirmado" : "Não foi possível concluir",
      description: outcome.error.message,
      variant: outcome.status === "uncertain" ? "default" : "destructive",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Encerrar atendimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {uncertainAttempt && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                A tentativa anterior não foi confirmada. Parâmetros bloqueados; o retry reutiliza a
                mesma chave de idempotência.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Novo status</Label>
            <RadioGroup
              value={novoStatus}
              onValueChange={(v) => setNovoStatus(v as CtEncerramentoStatus)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CANCELADO" id="ct2-enc-cancelado" disabled={uncertainAttempt} />
                <Label htmlFor="ct2-enc-cancelado" className="text-xs font-normal">
                  Cancelado
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="LIBERADO" id="ct2-enc-liberado" disabled={uncertainAttempt} />
                <Label htmlFor="ct2-enc-liberado" className="text-xs font-normal">
                  Liberado
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Motivo (mínimo {CT_TEXTO_MIN} caracteres)</Label>
            <Textarea
              rows={3}
              value={motivo}
              disabled={uncertainAttempt}
              onChange={(e) => setMotivo(e.target.value)}
            />
            {!motivoValido && motivo.length > 0 && (
              <p className="text-[11px] text-destructive">Mínimo de {CT_TEXTO_MIN} caracteres.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Fechar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !motivoValido || bloqueadoPorConflito}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {uncertainAttempt ? "Repetir operação" : "Confirmar encerramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EncerrarAtendimentoModal;
