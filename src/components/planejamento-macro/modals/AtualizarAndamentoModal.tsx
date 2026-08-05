import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatarPercentualBR,
  parsePercentualPtBR,
} from "@/lib/planejamentoMacro/progresso/resolverProgresso";
import { useAtualizarProgressoManual } from "@/hooks/planejamentoMacro/useAtualizarProgressoManual";
import type { AtividadePlanejada } from "@/types/planejamentoMacro";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  atividade: AtividadePlanejada | null;
}

const AtualizarAndamentoModal: React.FC<Props> = ({ open, onOpenChange, atividade }) => {
  const mutation = useAtualizarProgressoManual();
  const [pctInput, setPctInput] = useState("");
  const [obsInput, setObsInput] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open && atividade) {
      const pct = atividade.percentual_manual;
      setPctInput(
        pct == null
          ? ""
          : pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      );
      setObsInput(atividade.percentual_manual_observacao ?? "");
      setErro(null);
    }
  }, [open, atividade]);

  if (!atividade) return null;

  const handleSubmit = () => {
    setErro(null);
    const parsed = parsePercentualPtBR(pctInput);
    if (parsed != null && Number.isNaN(parsed)) {
      setErro("Percentual inválido. Use números (ex.: 35,5).");
      return;
    }
    if (parsed != null && (parsed < 0 || parsed > 100)) {
      setErro("Percentual deve estar entre 0 e 100.");
      return;
    }
    if (obsInput.length > 500) {
      setErro("Observação deve ter no máximo 500 caracteres.");
      return;
    }

    mutation.mutate(
      {
        atividadeId: atividade.id,
        percentual: parsed,
        observacao: obsInput.trim() === "" ? null : obsInput.trim(),
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  const atualizadoEm = atividade.percentual_manual_atualizado_em
    ? new Date(atividade.percentual_manual_atualizado_em).toLocaleString("pt-BR")
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar andamento</DialogTitle>
          <DialogDescription>
            Informe o percentual concluído manualmente. Este valor não altera o avanço importado do
            cronograma (MS Project).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Atividade</Label>
            <div className="text-sm font-medium">{atividade.nome}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status atual</Label>
              <div>
                <Badge variant="outline">{atividade.status}</Badge>
              </div>
            </div>
            {atividade.percentual_concluido_importado != null && (
              <div className="ml-auto space-y-1">
                <Label className="text-xs text-muted-foreground">Importado</Label>
                <div className="text-sm tabular-nums">
                  {formatarPercentualBR(Number(atividade.percentual_concluido_importado))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="percentual">Percentual concluído</Label>
            <Input
              id="percentual"
              inputMode="decimal"
              placeholder="Ex.: 35,5"
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Aceita vírgula decimal. Deixe vazio para limpar o valor manual.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              maxLength={500}
              rows={3}
              placeholder="Justificativa, evento, marco atingido..."
              value={obsInput}
              onChange={(e) => setObsInput(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {obsInput.length}/500
            </p>
          </div>

          <div className="rounded border bg-muted/40 p-2 text-[11px] text-muted-foreground space-y-0.5">
            <div>
              <span className="font-medium">Fonte:</span> manual
            </div>
            {atualizadoEm && (
              <div>
                <span className="font-medium">Última atualização:</span> {atualizadoEm}
              </div>
            )}
          </div>

          {(() => {
            const statusAtual = atividade.status;
            const trimmed = pctInput.trim();
            const parsedPreview = parsePercentualPtBR(pctInput);
            const isInvalid =
              trimmed !== "" && (parsedPreview == null || Number.isNaN(parsedPreview));
            const isOutOfRange =
              parsedPreview != null &&
              !Number.isNaN(parsedPreview) &&
              (parsedPreview < 0 || parsedPreview > 100);

            if (isInvalid || isOutOfRange) return null;

            let msg: React.ReactNode = null;

            if (statusAtual === "Cancelada") {
              msg = (
                <>Atividade cancelada. O status <strong>não será alterado</strong> automaticamente.</>
              );
            } else if (parsedPreview == null) {
              msg = (
                <>O percentual manual será limpo. O status <strong>não será alterado</strong> automaticamente.</>
              );
            } else if (statusAtual === "Atrasada") {
              msg =
                parsedPreview === 100 ? (
                  <>Ao salvar, o status da atividade será ajustado para <strong>Concluída</strong>.</>
                ) : (
                  <>Atividade atrasada. O status permanecerá <strong>Atrasada</strong> até atingir 100%.</>
                );
            } else if (parsedPreview === 0) {
              msg = <>Ao salvar, o status da atividade será ajustado para <strong>Planejada</strong>.</>;
            } else if (parsedPreview === 100) {
              msg = <>Ao salvar, o status da atividade será ajustado para <strong>Concluída</strong>.</>;
            } else {
              msg = <>Ao salvar, o status da atividade será ajustado para <strong>Em andamento</strong>.</>;
            }

            return (
              <div className="rounded border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                {msg}
              </div>
            );
          })()}

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AtualizarAndamentoModal;
