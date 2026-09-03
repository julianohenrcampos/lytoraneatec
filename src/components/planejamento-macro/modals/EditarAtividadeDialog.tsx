// Fase 6G — Modal de edição individual de atividade planejada (SuperAdm).
// Fase 1C-2B — Modo Saneamento: edita apenas quantidade/unidade e usa RPC transacional
// com auditoria (auth.uid() server-side, marca quantidade_origem='manual').
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Info, ChevronDown } from "lucide-react";
import {
  atividadeEditSchema,
  type AtividadeEditValues,
} from "./schemas";
import type { PlanejamentoAtividadeRow } from "@/services/planejamentoMacro/planejamentoMacroService";
import { useAtualizarAtividadePlanejada } from "@/hooks/planejamentoMacro/useAtualizarAtividadePlanejada";
import { useCorrigirQuantitativoAtividade } from "@/hooks/planejamentoMacro/useCorrigirQuantitativoAtividade";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atividade: PlanejamentoAtividadeRow | null;
  planejamentoStatus: "rascunho" | "vigente" | "arquivado" | null;
  /** Fase 1C-2B — quando true, exibe apenas quantidade/unidade + observação e usa RPC. */
  modoSaneamento?: boolean;
}


const toFormDefaults = (
  a: PlanejamentoAtividadeRow | null
): Partial<AtividadeEditValues> => {
  if (!a) return {};
  const prioridade = (["baixa", "media", "alta"] as const).includes(
    a.prioridade as never
  )
    ? (a.prioridade as "baixa" | "media" | "alta")
    : "media";
  const status = (
    ["planejada", "em_andamento", "concluida", "atrasada", "cancelada"] as const
  ).includes(a.status as never)
    ? (a.status as AtividadeEditValues["status"])
    : "planejada";
  return {
    nome: a.nome ?? "",
    codigo_wbs: a.codigo_wbs ?? null,
    descricao: a.descricao ?? null,
    frente_servico: a.frente_servico ?? null,
    data_inicio: a.data_inicio,
    data_fim: a.data_fim,
    unidade: a.unidade ?? null,
    quantidade_prevista:
      a.quantidade_prevista != null ? Number(a.quantidade_prevista) : null,
    producao_prevista:
      a.producao_prevista != null ? Number(a.producao_prevista) : null,
    prioridade,
    status,
    ordem_execucao:
      a.ordem_execucao != null ? Number(a.ordem_execucao) : null,
  };
};

const EditarAtividadeDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  atividade,
  planejamentoStatus,
  modoSaneamento = false,
}) => {
  const mutation = useAtualizarAtividadePlanejada();
  const corrigir = useCorrigirQuantitativoAtividade();
  const [observacao, setObservacao] = useState("");

  const form = useForm<AtividadeEditValues>({
    resolver: zodResolver(atividadeEditSchema),
    defaultValues: toFormDefaults(atividade) as AtividadeEditValues,
  });

  useEffect(() => {
    if (open && atividade) {
      form.reset(toFormDefaults(atividade) as AtividadeEditValues);
      setObservacao("");
    }
  }, [open, atividade, form]);

  if (planejamentoStatus === "arquivado") return null;

  const onSubmit = async (values: AtividadeEditValues) => {
    if (!atividade) return;
    try {
      if (modoSaneamento) {
        await corrigir.mutateAsync({
          atividadeId: atividade.id,
          planejamentoId: atividade.planejamento_id,
          quantidadePrevista: values.quantidade_prevista ?? null,
          unidade: values.unidade ?? null,
          observacao: observacao.trim() || null,
        });
        onOpenChange(false);
        return;
      }
      // Fase 6G.2 — codigo_wbs NÃO é enviado: campo estrutural importado do cronograma.
      await mutation.mutateAsync({
        id: atividade.id,
        planejamento_id: atividade.planejamento_id,
        patch: {
          nome: values.nome,
          descricao: values.descricao ?? null,
          frente_servico: values.frente_servico ?? null,
          data_inicio: values.data_inicio,
          data_fim: values.data_fim,
          unidade: values.unidade ?? null,
          quantidade_prevista: values.quantidade_prevista ?? null,
          producao_prevista: values.producao_prevista ?? null,
          prioridade: values.prioridade,
          status: values.status,
          ordem_execucao: values.ordem_execucao ?? null,
        },
      });
      onOpenChange(false);
    } catch {
      /* toast tratado no hook */
    }
  };

  const errors = form.formState.errors;
  const pending = modoSaneamento ? corrigir.isPending : mutation.isPending;

  if (modoSaneamento) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Corrigir quantidade/unidade</DialogTitle>
            <DialogDescription>
              {atividade?.nome
                ? `Atividade: ${atividade.nome}.`
                : "Atualize quantidade e unidade desta atividade."}{" "}
              A correção marca a origem como <strong>Manual</strong> e é auditada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantidade_prevista">Quantidade prevista</Label>
                <Input
                  id="quantidade_prevista"
                  type="number"
                  min={0}
                  step="any"
                  {...form.register("quantidade_prevista")}
                />
                {errors.quantidade_prevista && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.quantidade_prevista.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="unidade">Unidade (m, m², m³, un...)</Label>
                <Input id="unidade" {...form.register("unidade")} />
              </div>
            </div>
            <div>
              <Label htmlFor="observacao">Observação da correção (opcional)</Label>
              <Textarea
                id="observacao"
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: quantidade conferida em projeto executivo."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Vai apenas para o log de auditoria.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Salvando..." : "Salvar correção"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

        <DialogHeader>
          <DialogTitle>Editar atividade do cronograma</DialogTitle>
          <DialogDescription>
            As alterações afetam a atividade inteira do cronograma, não apenas a semana atual.
            Apenas SuperAdm. Datas em formato YYYY-MM-DD.
          </DialogDescription>
        </DialogHeader>

        {planejamentoStatus === "vigente" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Você está editando uma atividade de um planejamento vigente. A
              alteração será refletida imediatamente na visualização do
              planejamento.
            </AlertDescription>
          </Alert>
        )}
        {planejamentoStatus === "rascunho" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Você está editando uma atividade de uma versão em rascunho.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* === Dados operacionais === */}
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Dados operacionais</h3>
            <p className="text-xs text-muted-foreground">
              Campos usados no dia a dia da obra.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" {...form.register("nome")} />
              {errors.nome && (
                <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="frente_servico">Frente</Label>
              <Input id="frente_servico" {...form.register("frente_servico")} />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" rows={2} {...form.register("descricao")} />
            </div>

            <div>
              <Label htmlFor="data_inicio">Data início *</Label>
              <Input id="data_inicio" type="date" {...form.register("data_inicio")} />
              {errors.data_inicio && (
                <p className="text-xs text-destructive mt-1">
                  {errors.data_inicio.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="data_fim">Data fim *</Label>
              <Input id="data_fim" type="date" {...form.register("data_fim")} />
              {errors.data_fim && (
                <p className="text-xs text-destructive mt-1">
                  {errors.data_fim.message}
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="quantidade_prevista"
                title="Quantidade total prevista de escopo (ex.: 120 m³, 50 un). Vem do MS Project quando disponível."
              >
                Quantidade prevista (escopo)
              </Label>
              <Input
                id="quantidade_prevista"
                type="number"
                min={0}
                step="any"
                {...form.register("quantidade_prevista")}
              />
              {errors.quantidade_prevista && (
                <p className="text-xs text-destructive mt-1">
                  {errors.quantidade_prevista.message}
                </p>
              )}
            </div>
            <div>
              <Label
                htmlFor="producao_prevista"
                title="Meta de produtividade por dia ou turno. Não representa avanço real — esse virá de apontamento/Diário de Obra."
              >
                Produção prevista (por dia/turno)
              </Label>
              <Input
                id="producao_prevista"
                type="number"
                min={0}
                step="any"
                {...form.register("producao_prevista")}
              />
              {errors.producao_prevista && (
                <p className="text-xs text-destructive mt-1">
                  {errors.producao_prevista.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <Label
                htmlFor="unidade"
                title="Unidade de medida da atividade. Usada em apontamento, Diário de Obra e KPI de produtividade."
              >
                Unidade de medida{" "}
                {(form.watch("quantidade_prevista") != null &&
                  form.watch("quantidade_prevista") !== ("" as unknown as number)) ||
                (form.watch("producao_prevista") != null &&
                  form.watch("producao_prevista") !== ("" as unknown as number))
                  ? "*"
                  : ""}
              </Label>
              <Input
                id="unidade"
                placeholder="ex.: m, m², m³, un, t"
                {...form.register("unidade")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usada em apontamento, Diário de Obra e KPI de produtividade.
              </p>
              {errors.unidade && (
                <p className="text-xs text-destructive mt-1">
                  {errors.unidade.message as string}
                </p>
              )}
            </div>


            <div>
              <Label>Prioridade</Label>
              <Select
                value={form.watch("prioridade")}
                onValueChange={(v) =>
                  form.setValue("prioridade", v as AtividadeEditValues["prioridade"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as AtividadeEditValues["status"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="atrasada">Atrasada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* === Campos avançados === */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between text-sm font-medium border-t pt-3 mt-2 rounded-none hover:bg-transparent"
              >
                <span>Campos avançados</span>
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="text-xs text-muted-foreground mb-3">
                Campos estruturais vindos da importação do cronograma. Geralmente não precisam ser alterados.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="codigo_wbs"
                    title="EAP corresponde ao código WBS importado do MS Project."
                  >
                    Código EAP
                  </Label>
                  <Input
                    id="codigo_wbs"
                    readOnly
                    disabled
                    className="bg-muted cursor-not-allowed"
                    {...form.register("codigo_wbs")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Estrutural, importado do cronograma. Não editável.
                  </p>
                </div>
                <div>
                  <Label
                    htmlFor="ordem_execucao"
                    title="Sequência interna gerada pelo parser durante a importação (não vem do MS Project)."
                  >
                    Sequência de leitura (importação)
                  </Label>
                  <Input
                    id="ordem_execucao"
                    type="number"
                    min={0}
                    step={1}
                    {...form.register("ordem_execucao")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Índice de ordenação gerado na importação. Não é prioridade.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditarAtividadeDialog;
