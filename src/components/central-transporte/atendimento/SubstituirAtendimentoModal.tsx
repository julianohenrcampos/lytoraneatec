/**
 * CT-2 / M4 — Modal de substituição (encerra o atual + cria novo, atômico na RPC).
 * Exige candidato substituto selecionado na análise operacional.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { substituirAtendimento } from "@/services/centralTransporteAtendimentoService";
import { candidateLabel } from "@/utils/central-transporte/ctCandidateAdapter";
import {
  CT_MODALIDADE_LABELS,
  CT_TEXTO_MIN,
  type CtAtendimento,
  type CtCandidateSelection,
  type CtModalidade,
} from "@/types/centralTransporteCT2";
import type { CtOperationApi } from "@/hooks/central-transporte/useCtOperation";

interface Props {
  open: boolean;
  onClose: () => void;
  atendimento: CtAtendimento;
  candidate: CtCandidateSelection | null;
  modalidade: CtModalidade;
  ctOperation: CtOperationApi;
  onSuccess: () => void;
}

const SubstituirAtendimentoModal: React.FC<Props> = ({
  open,
  onClose,
  atendimento,
  candidate,
  modalidade,
  ctOperation,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const materialKey = JSON.stringify([
    "SUBSTITUIR",
    atendimento.id,
    candidate?.equipamentoId ?? null,
    modalidade,
    motivo.trim(),
  ]);
  const uncertainAttempt = ctOperation.getAttempt(materialKey)?.state === "UNCERTAIN";
  const motivoValido = motivo.trim().length >= CT_TEXTO_MIN;
  /** O servidor recusa (CT2_SUBSTITUICAO_SEM_EFEITO); o frontend bloqueia antes. */
  const substitutoIgualAoAtual =
    !!candidate && candidate.equipamentoId === atendimento.equipamento_id;

  const handleSubmit = async () => {
    if (!candidate || substitutoIgualAoAtual) return;
    setSubmitting(true);
    const outcome = await ctOperation.run({
      operation: "SUBSTITUIR",
      materialKey,
      resourceIds: [
        atendimento.id,
        atendimento.solicitacao_item_id,
        atendimento.equipamento_id,
        candidate.equipamentoId,
      ],
      exec: (requestId) =>
        substituirAtendimento({
          atendimentoId: atendimento.id,
          novoEquipamentoId: candidate.equipamentoId,
          modalidade,
          motivo: motivo.trim(),
          requestId,
        }),
    });
    setSubmitting(false);

    if (outcome.status === "ok") {
      toast({
        title: outcome.replay ? "Operação já registrada" : "Atendimento substituído",
        description: outcome.replay
          ? "Esta operação já havia sido processada — nenhum registro duplicado foi criado."
          : "O atendimento anterior foi encerrado e o novo foi criado.",
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
          <DialogTitle className="text-base">Substituir atendimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {uncertainAttempt && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                A tentativa anterior não foi confirmada. Repita a operação com os mesmos parâmetros.
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1">
            <div>
              <strong>Atual:</strong>{" "}
              {[atendimento.equipamento_frota, atendimento.equipamento_numero]
                .filter(Boolean)
                .join(" ") || atendimento.equipamento_placa || atendimento.equipamento_id}
            </div>
            <div>
              <strong>Substituto:</strong>{" "}
              {candidate ? candidateLabel(candidate) : "— selecione um candidato na análise —"}
            </div>
            <div>
              <strong>Modalidade:</strong> {CT_MODALIDADE_LABELS[modalidade]}
            </div>
          </div>

          {!candidate && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Selecione o equipamento substituto na lista de ativos antes de confirmar.
              </AlertDescription>
            </Alert>
          )}

          {substitutoIgualAoAtual && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                O equipamento substituto é o mesmo já atribuído. Selecione outro ativo.
              </AlertDescription>
            </Alert>
          )}

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
            data-testid="ct2-substituir-confirmar"
            disabled={submitting || !candidate || substitutoIgualAoAtual || !motivoValido}
            className="gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {uncertainAttempt ? "Repetir operação" : "Confirmar substituição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubstituirAtendimentoModal;
