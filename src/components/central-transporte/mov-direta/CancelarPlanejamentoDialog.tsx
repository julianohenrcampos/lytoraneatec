/**
 * CT-4 — confirmação central do cancelamento do planejamento de uma
 * Movimentação Direta.
 *
 * Só apresentação e composição do motivo: o servidor
 * (`fn_ct_mov_direta_cancelar`) continua sendo a autoridade sobre quais
 * status podem ser cancelados. Nada é excluído — cancelar apenas muda o
 * status e preserva todo o histórico.
 */
import React, { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const MOTIVOS_CANCELAMENTO = [
  "Condições climáticas",
  "Obra impedida",
  "Mudança de planejamento",
  "Equipamento indisponível",
  "Transporte indisponível",
  "Outro",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number];

/** Texto determinístico enviado ao servidor. */
export const montarMotivoCancelamento = (
  motivo: string,
  descricao: string,
  observacao: string,
): string => {
  const partes = [descricao.trim(), observacao.trim()].filter(Boolean);
  return partes.length > 0 ? `${motivo} — ${partes.join(" | ")}` : motivo;
};

interface Props {
  aberto: boolean;
  codigo: string;
  emAndamento: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: string) => void;
}

const CancelarPlanejamentoDialog: React.FC<Props> = ({
  aberto,
  codigo,
  emAndamento,
  onFechar,
  onConfirmar,
}) => {
  const [motivo, setMotivo] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = useMemo(
    () => MOTIVOS_CANCELAMENTO.map((m) => ({ value: m, label: m })),
    [],
  );

  const fechar = () => {
    setMotivo("");
    setDescricao("");
    setObservacao("");
    setErro(null);
    onFechar();
  };

  const confirmar = () => {
    if (!motivo) {
      setErro("Selecione o motivo do cancelamento.");
      return;
    }
    if (motivo === "Outro" && descricao.trim().length < 5) {
      setErro('Ao escolher "Outro", descreva o motivo do cancelamento.');
      return;
    }
    setErro(null);
    onConfirmar(montarMotivoCancelamento(motivo, descricao, observacao));
  };

  return (
    <AlertDialog open={aberto} onOpenChange={(o) => !o && !emAndamento && fechar()}>
      <AlertDialogContent data-testid="ct4-cancelar-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar planejamento?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            A movimentação {codigo} será cancelada e os ativos deixarão de ficar comprometidos
            por este planejamento. O histórico será preservado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Motivo do cancelamento *</Label>
            <Combobox
              options={opcoes}
              value={motivo}
              placeholder="Selecione o motivo"
              onChange={(v) => setMotivo(v)}
            />
          </div>

          {motivo === "Outro" && (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Descreva o motivo *</Label>
              <Textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Explique o motivo do cancelamento"
                data-testid="ct4-cancelar-descricao"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[11px]">Observação complementar</Label>
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
              data-testid="ct4-cancelar-observacao"
            />
          </div>

          {erro && (
            <p className="text-xs text-destructive" data-testid="ct4-cancelar-erro">
              {erro}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={emAndamento}
            onClick={fechar}
          >
            Manter planejamento
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="text-xs"
            disabled={emAndamento}
            onClick={confirmar}
            data-testid="ct4-cancelar-confirmar"
          >
            {emAndamento && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Cancelar movimentação
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CancelarPlanejamentoDialog;
