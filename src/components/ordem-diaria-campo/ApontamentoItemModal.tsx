import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRegistrarApontamento } from "@/hooks/ordemDiariaCampo/useApontamentosItem";
import type {
  StatusExecucaoApontamento,
} from "@/services/ordemDiariaCampo/apontamentoService";
import type { OrdemDiariaItem, EquipeSnapshotItem } from "@/types/ordemDiariaObra";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: OrdemDiariaItem;
}

const STATUS_OPTIONS: { value: StatusExecucaoApontamento; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "impedido", label: "Impedido" },
  { value: "paralisado", label: "Paralisado" },
];

export const ApontamentoItemModal: React.FC<Props> = ({
  open,
  onOpenChange,
  item,
}) => {
  const { toast } = useToast();
  const mutation = useRegistrarApontamento(item.id);

  const [status, setStatus] = useState<StatusExecucaoApontamento>("em_andamento");
  const [quantidade, setQuantidade] = useState<string>("");
  const [metaInformada, setMetaInformada] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [equipeIds, setEquipeIds] = useState<string[]>([]);

  const equipeSnap = (item.equipe_snapshot ?? []) as EquipeSnapshotItem[];
  const equipeValida = useMemo(
    () => equipeSnap.filter((m) => !!m.funcionario_id),
    [equipeSnap]
  );

  const requerQtd = status === "em_andamento" || status === "concluido";
  const requerMotivo = status === "impedido" || status === "paralisado";
  const unidade = item.atividade_unidade_medida_snapshot ?? "";

  const qtdNum = quantidade.trim() === "" ? null : Number(quantidade.replace(",", "."));
  const metaNum =
    metaInformada.trim() === "" ? null : Number(metaInformada.replace(",", "."));

  // Prévia do percentual (mesma lógica do servidor, sem cap)
  const percPreview = useMemo(() => {
    const metaBase =
      metaNum && metaNum > 0
        ? metaNum
        : item.atividade_quantidade_planejada_snapshot ?? null;
    if (!metaBase || metaBase <= 0 || qtdNum == null || Number.isNaN(qtdNum)) {
      return null;
    }
    return Math.round((qtdNum / metaBase) * 100 * 100) / 100;
  }, [qtdNum, metaNum, item.atividade_quantidade_planejada_snapshot]);

  const resetForm = () => {
    setStatus("em_andamento");
    setQuantidade("");
    setMetaInformada("");
    setObservacao("");
    setMotivo("");
    setEquipeIds([]);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !mutation.isPending) resetForm();
    onOpenChange(nextOpen);
  };

  const canSubmit = (() => {
    if (mutation.isPending) return false;
    if (requerQtd && (qtdNum == null || Number.isNaN(qtdNum) || qtdNum < 0)) return false;
    if (requerMotivo && motivo.trim().length < 10) return false;
    return true;
  })();

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({
        item_id: item.id,
        status_execucao: status,
        quantidade_executada: requerQtd ? qtdNum : qtdNum,
        meta_dia_informada: metaNum,
        equipe_presente: equipeIds,
        observacao: observacao.trim() || null,
        motivo_impedimento: requerMotivo ? motivo.trim() : null,
      });
      toast({
        title: "Apontamento registrado",
        description: "Execução real registrada com sucesso.",
      });
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Falha ao registrar",
        description: err?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const toggleMembro = (id: string) => {
    setEquipeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar apontamento</DialogTitle>
          <DialogDescription className="text-xs">
            {item.nome_atividade_snapshot}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Status *</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as StatusExecucaoApontamento)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Quantidade executada {requerQtd && "*"} {unidade && `(${unidade})`}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.001"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Meta do dia (opcional)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.001"
                value={metaInformada}
                onChange={(e) => setMetaInformada(e.target.value)}
                placeholder="Auto"
              />
            </div>
          </div>

          {percPreview != null && (
            <div className="text-xs">
              Percentual estimado:{" "}
              <span
                className={
                  percPreview > 100
                    ? "font-semibold text-destructive"
                    : "font-semibold"
                }
              >
                {percPreview}%
              </span>
              {percPreview > 100 && (
                <span className="ml-1 inline-flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" /> acima da meta
                </span>
              )}
            </div>
          )}

          {requerMotivo && (
            <div className="space-y-1.5">
              <Label>Motivo do impedimento * (mín. 10 caracteres)</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo..."
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Equipe presente</Label>
            {equipeValida.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum membro no snapshot da tarefa.
              </p>
            ) : (
              <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                {equipeValida.map((m) => {
                  const id = m.funcionario_id as string;
                  const checked = equipeIds.includes(id);
                  return (
                    <label
                      key={id}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleMembro(id)}
                      />
                      <span className="flex-1 truncate">
                        {m.nome ?? id}
                        {m.funcao && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {m.funcao}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Apenas membros do snapshot podem ser marcados. Terceiros vão em
              "Observação".
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Comentários adicionais (opcional)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {mutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
