/**
 * CT-2 / M4 — Modal de atribuição (INTERNO / RESERVA_FUTURA).
 * Não possui estado definitivo de tentativa: o request_id é gerenciado pelo
 * CentralTransportePage através de CtOperationApi.
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  ALERTA_CONFLITO_ATENDIMENTO,
  SEM_CENTRO_CUSTO_LABEL,
} from "@/lib/ativos/reconciliacaoOperacional";
import { useToast } from "@/hooks/use-toast";
import { atribuirAtendimento } from "@/services/centralTransporteAtendimentoService";
import { candidateLabel } from "@/utils/central-transporte/ctCandidateAdapter";
import {
  CT_MODALIDADE_LABELS,
  CT_TEXTO_MIN,
  type CtCandidateSelection,
  type CtModalidade,
} from "@/types/centralTransporteCT2";
import type { CtOperationApi } from "@/hooks/central-transporte/useCtOperation";
import useEstadoEfetivoAtivos from "@/hooks/central-transporte/useEstadoEfetivoAtivos";
import {
  CT_MSG_COMPROMISSO_RESTRITO,
  CT_MSG_PERIODO_OBRIGATORIO,
} from "@/types/centralTransporteEstadoEfetivo";
import { janelaComprometida } from "@/utils/central-transporte/estadoEfetivoBadges";

interface Props {
  open: boolean;
  onClose: () => void;
  solicitacaoItemId: string;
  candidate: CtCandidateSelection;
  modalidade: CtModalidade;
  canAprovar: boolean;
  ctOperation: CtOperationApi;
  onSuccess: () => void;
}

const AtribuirAtendimentoModal: React.FC<Props> = ({
  open,
  onClose,
  solicitacaoItemId,
  candidate,
  modalidade,
  canAprovar,
  ctOperation,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // CT-2.2: a Reserva Futura sempre exige período explícito, mesmo sem aprovação.
  const exigePeriodo = modalidade === "RESERVA_FUTURA";
  const usaPeriodo = exigePeriodo || canAprovar;

  const materialKey = JSON.stringify([
    "ATRIBUIR",
    solicitacaoItemId,
    candidate.equipamentoId,
    modalidade,
    usaPeriodo ? periodoInicio || null : null,
    usaPeriodo ? periodoFim || null : null,
    canAprovar ? justificativa.trim() : "",
  ]);

  const periodoIncompleto = exigePeriodo && (!periodoInicio || !periodoFim);
  const periodoInvertido =
    !!periodoInicio && !!periodoFim && periodoFim < periodoInicio;

  // Revalidação server-side da JANELA informada (fail-closed).
  const janelaQuery = useEstadoEfetivoAtivos({
    equipamentoIds: [candidate.equipamentoId],
    periodoInicio: usaPeriodo ? periodoInicio || null : null,
    periodoFim: usaPeriodo ? periodoFim || null : null,
    enabled:
      open && exigePeriodo && !periodoIncompleto && !periodoInvertido,
  });

  const janelaBloqueada =
    exigePeriodo &&
    !periodoIncompleto &&
    !periodoInvertido &&
    (!janelaQuery.consultado ||
      janelaComprometida(janelaQuery.estados.get(candidate.equipamentoId)));

  const attempt = ctOperation.getAttempt(materialKey);
  const travadoPorIncerteza = ctOperation.attempts.size > 0 && !attempt
    ? ctOperation.isBlocked([solicitacaoItemId, candidate.equipamentoId], materialKey)
    : false;

  const uncertainAttempt = Array.from(ctOperation.attempts.values()).find(
    (a) => a.state === "UNCERTAIN" && a.materialKey === materialKey,
  );

  const justificativaInvalida =
    canAprovar && justificativa.trim().length > 0 && justificativa.trim().length < CT_TEXTO_MIN;

  const disabled =
    submitting ||
    travadoPorIncerteza ||
    justificativaInvalida ||
    periodoIncompleto ||
    periodoInvertido ||
    janelaBloqueada ||
    attempt?.state === "PENDING";

  const handleSubmit = async () => {
    setSubmitting(true);
    const outcome = await ctOperation.run({
      operation: "ATRIBUIR",
      materialKey,
      resourceIds: [solicitacaoItemId, candidate.equipamentoId],
      exec: (requestId) =>
        atribuirAtendimento({
          solicitacaoItemId,
          equipamentoId: candidate.equipamentoId,
          modalidade,
          requestId,
          periodoInicio: usaPeriodo ? periodoInicio || null : null,
          periodoFim: usaPeriodo ? periodoFim || null : null,
          justificativaOverride: canAprovar && justificativa.trim() ? justificativa.trim() : null,
        }),
    });
    setSubmitting(false);

    if (outcome.status === "ok") {
      toast({
        title: outcome.replay ? "Operação já registrada" : "Atendimento registrado",
        description: outcome.replay
          ? "Esta operação já havia sido processada — nenhum registro duplicado foi criado."
          : `${CT_MODALIDADE_LABELS[modalidade]} vinculado ao item.`,
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
          <DialogTitle className="text-base">
            {modalidade === "INTERNO" ? "Atender com ativo interno" : "Reservar ativo futuro"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1">
            <div>
              <strong>Equipamento:</strong> {candidateLabel(candidate)}
            </div>
            <div>
              <strong>Origem:</strong> {candidate.origem} · <strong>Status:</strong>{" "}
              {candidate.disponibilidadeStatus} · <strong>Match:</strong> {candidate.matchTipo}
            </div>
            <div>
              <strong>CC atual:</strong>{" "}
              {candidate.possuiCentroCustoAtual
                ? candidate.centroCustoLabel
                : SEM_CENTRO_CUSTO_LABEL}
              {candidate.jaNoCentroCustoDestino && " · já no centro de custo de destino"}
            </div>
            {!candidate.possuiRegistroDisponibilidade && (
              <div className="text-muted-foreground">
                Ativo sem registro de disponibilidade — situação cadastral:{" "}
                {candidate.situacaoCadastral ?? "não informada"}.
              </div>
            )}
            {candidate.matchMotivo && (
              <div className="text-muted-foreground">
                <strong>Match:</strong> {candidate.matchMotivo}
              </div>
            )}
          </div>

          {candidate.conflitoCadastral && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {candidate.conflitoCadastralMotivo} {ALERTA_CONFLITO_ATENDIMENTO}
              </AlertDescription>
            </Alert>
          )}

          {uncertainAttempt && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                A tentativa anterior não foi confirmada. Os parâmetros estão bloqueados e o retry usa
                a mesma chave de idempotência — repita a operação para descobrir o desfecho real.
              </AlertDescription>
            </Alert>
          )}

          {candidate.matchTipo === "PARCIAL" && !canAprovar && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Compatibilidade parcial exige permissão de aprovação. O servidor recusará esta operação.
              </AlertDescription>
            </Alert>
          )}

          {periodoIncompleto && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {CT_MSG_PERIODO_OBRIGATORIO}
              </AlertDescription>
            </Alert>
          )}

          {janelaBloqueada && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {CT_MSG_COMPROMISSO_RESTRITO}
              </AlertDescription>
            </Alert>
          )}

          {usaPeriodo ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Início do período</Label>
                  <Input
                    type="date"
                    value={periodoInicio}
                    disabled={!!uncertainAttempt}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim do período</Label>
                  <Input
                    type="date"
                    value={periodoFim}
                    disabled={!!uncertainAttempt}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                  />
                </div>
              </div>
              {canAprovar && (
                <div className="space-y-1">
                  <Label className="text-xs">
                    Justificativa de override (opcional, mín. {CT_TEXTO_MIN})
                  </Label>
                  <Textarea
                    rows={3}
                    value={justificativa}
                    disabled={!!uncertainAttempt}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                  {justificativaInvalida && (
                    <p className="text-[11px] text-destructive">
                      Mínimo de {CT_TEXTO_MIN} caracteres.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem permissão de aprovação: o período segue a janela aprovada da solicitação.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Fechar
          </Button>
          <Button onClick={handleSubmit} disabled={disabled} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {uncertainAttempt ? "Repetir operação" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AtribuirAtendimentoModal;
