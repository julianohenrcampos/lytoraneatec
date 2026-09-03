/**
 * Diálogo automático exibido ao solicitante quando o chamado recebe resposta
 * ou é resolvido pelo atendente. Pergunta se ele deseja encerrar ou continuar.
 *
 * Regra de negócio: encerrar pelo solicitante significa que o chamado foi
 * resolvido (o backend registra a resolução antes do encerramento).
 * A classificação do atendimento (1 a 5) é obrigatória para encerrar.
 */
import React from "react";
import { CheckCircle2, Loader2, RefreshCw, Star } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/chamados-internos/StatusBadges";
import type { ChamadoInternoStatus } from "@/types/chamadosInternos";

export interface RespostaSolicitanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolo: string;
  status: ChamadoInternoStatus;
  /** Última mensagem do atendente (resposta ou resolução). */
  ultimaMensagem?: string | null;
  autorNome?: string | null;
  podeEncerrar: boolean;
  podeReabrir: boolean;
  isEncerrando: boolean;
  onEncerrar: (avaliacao: {
    nota: number | null;
    comentario: string | null;
  }) => Promise<void> | void;
  onPrecisoAjuda: () => void;
  onDepois: () => void;
}

const NOTA_LABELS: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Ótimo",
};

export const RespostaSolicitanteDialog: React.FC<
  RespostaSolicitanteDialogProps
> = ({
  open,
  onOpenChange,
  protocolo,
  status,
  ultimaMensagem,
  autorNome,
  podeEncerrar,
  podeReabrir,
  isEncerrando,
  onEncerrar,
  onPrecisoAjuda,
  onDepois,
}) => {
  const [nota, setNota] = React.useState<number | null>(null);
  const [comentario, setComentario] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setNota(null);
      setComentario("");
    }
  }, [open]);

  const encerrarBloqueado = !podeEncerrar || nota == null || isEncerrando;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isEncerrando && !next) return;
        if (!next) onDepois();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-full max-w-xl overflow-hidden p-6">
        <div className="w-full min-w-0">
          <DialogHeader className="w-full space-y-2 text-left">
            <DialogTitle className="w-full text-lg leading-tight">
              Sua solicitação foi atendida?
            </DialogTitle>
            <DialogDescription className="w-full whitespace-normal break-words text-sm">
              O setor respondeu ao chamado{" "}
              <span className="font-medium text-foreground">{protocolo}</span>.
              Confirme se podemos encerrar ou se você ainda precisa de ajuda.
            </DialogDescription>
            <div className="flex w-full items-center gap-2 pt-1 text-xs">
              <span className="text-muted-foreground">Status atual:</span>
              <StatusBadge status={status} />
            </div>
          </DialogHeader>

          <div className="w-full space-y-4 py-4">
            {ultimaMensagem ? (
              <div className="w-full box-border rounded-lg border bg-muted/40">
                {autorNome && (
                  <div className="w-full border-b px-3 py-2 text-xs font-medium text-foreground">
                    {autorNome}
                  </div>
                )}
                <div className="w-full max-h-40 overflow-y-auto px-3 py-2">
                  <p className="w-full whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                    {ultimaMensagem}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="w-full box-border space-y-3 rounded-lg border p-3">
              <div className="w-full space-y-0.5">
                <p className="w-full whitespace-normal break-words text-sm font-medium">
                  Classifique o atendimento
                </p>
                <p className="w-full whitespace-normal break-words text-xs text-muted-foreground">
                  Obrigatório para encerrar o chamado.
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Nota ${n} — ${NOTA_LABELS[n]}`}
                    aria-pressed={nota === n}
                    onClick={() => setNota(nota === n ? null : n)}
                    className="rounded-md p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        nota != null && n <= nota
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/50",
                      )}
                    />
                  </button>
                ))}
                <span className="ml-1 whitespace-normal break-words text-xs text-muted-foreground">
                  {nota != null
                    ? `${nota} de 5 — ${NOTA_LABELS[nota]}`
                    : "Selecione uma nota"}
                </span>
              </div>

              <Textarea
                rows={2}
                maxLength={2000}
                placeholder="Comentário sobre o atendimento (opcional)"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full resize-none"
              />
            </div>

            {!podeEncerrar && (
              <p className="w-full whitespace-normal break-words text-xs text-muted-foreground">
                O encerramento não está disponível para este chamado no momento.
              </p>
            )}
          </div>

          <DialogFooter className="flex w-full flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground sm:w-auto"
              onClick={onDepois}
              disabled={isEncerrando}
            >
              Decidir depois
            </Button>

            <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
              {podeReabrir && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={onPrecisoAjuda}
                  disabled={isEncerrando}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Ainda preciso de ajuda
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
                onClick={() =>
                  void onEncerrar({
                    nota,
                    comentario: comentario.trim() ? comentario.trim() : null,
                  })
                }
                disabled={encerrarBloqueado}
                title={
                  podeEncerrar && nota == null
                    ? "Selecione uma nota para encerrar"
                    : undefined
                }
              >
                {isEncerrando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Encerrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Encerrar chamado
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RespostaSolicitanteDialog;
