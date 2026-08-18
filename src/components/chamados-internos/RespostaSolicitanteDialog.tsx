/**
 * Diálogo automático exibido ao solicitante quando o chamado recebe resposta
 * ou é resolvido pelo atendente. Pergunta se ele deseja encerrar ou continuar.
 * Não substitui as regras do banco: "Encerrar" só é habilitado em `resolvido`.
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isEncerrando && !next) return;
        if (!next) onDepois();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sua solicitação foi atendida?</DialogTitle>
          <DialogDescription>
            O setor respondeu ao seu chamado {protocolo}. Confirme se podemos
            encerrar ou se você ainda precisa de ajuda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Status atual:</span>
            <StatusBadge status={status} />
          </div>

          {ultimaMensagem ? (
            <div className="rounded-md border bg-muted/40 p-3">
              {autorNome && (
                <p className="mb-1 text-xs text-muted-foreground">
                  por: {autorNome}
                </p>
              )}
              <p className="whitespace-pre-wrap">{ultimaMensagem}</p>
            </div>
          ) : null}

          {podeEncerrar && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium">
                Como você avalia o atendimento? (opcional)
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Nota ${n}`}
                    onClick={() => setNota(nota === n ? null : n)}
                    className="rounded p-1 transition-colors hover:bg-muted"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        nota != null && n <= nota
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </button>
                ))}
                {nota != null && (
                  <span className="ml-1 text-xs text-muted-foreground">{nota} de 5</span>
                )}
              </div>
              <Textarea
                rows={2}
                maxLength={2000}
                placeholder="Deixe um comentário sobre o atendimento (opcional)"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
            </div>
          )}

          {!podeEncerrar && (
            <p className="text-xs text-muted-foreground">
              O encerramento fica disponível quando o setor marcar o chamado como
              resolvido.
            </p>
          )}
        </div>


        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onDepois} disabled={isEncerrando}>
            Decidir depois
          </Button>
          {podeReabrir && (
            <Button
              variant="outline"
              onClick={onPrecisoAjuda}
              disabled={isEncerrando}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Ainda preciso de ajuda
            </Button>
          )}
          <Button
            onClick={() =>
              void onEncerrar({
                nota,
                comentario: comentario.trim() ? comentario.trim() : null,
              })
            }

            disabled={!podeEncerrar || isEncerrando}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RespostaSolicitanteDialog;
