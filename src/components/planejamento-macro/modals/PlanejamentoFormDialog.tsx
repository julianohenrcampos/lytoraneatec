// Fase 6E.1 — Modal de criação/edição de Planejamento da Obra (SuperAdm).
import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  planejamentoFormSchema,
  type PlanejamentoFormValues,
} from "./schemas";
import type { PlanejamentoObraRow } from "@/services/planejamentoMacro/planejamentoMacroService";

interface CentroCustoOption {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  centrosCusto: CentroCustoOption[];
  centroCustoIdPadrao?: string | null;
  /** Quando true e mode === 'create', a opção "vigente" é bloqueada. */
  haVigenteOutro: boolean;
  planejamento?: PlanejamentoObraRow | null;
  submitting?: boolean;
  onSubmit: (values: PlanejamentoFormValues) => Promise<void> | void;
}

const PlanejamentoFormDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  mode,
  centrosCusto,
  centroCustoIdPadrao,
  haVigenteOutro,
  planejamento,
  submitting,
  onSubmit,
}) => {
  const form = useForm<PlanejamentoFormValues>({
    resolver: zodResolver(planejamentoFormSchema),
    defaultValues: {
      centro_custo_id: centroCustoIdPadrao ?? "",
      periodo_inicio: "",
      periodo_fim: "",
      versao: 1,
      status: "rascunho",
      observacao: "",
    },
  });

  // Reset quando abre
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && planejamento) {
      form.reset({
        centro_custo_id: planejamento.centro_custo_id,
        periodo_inicio: planejamento.periodo_inicio,
        periodo_fim: planejamento.periodo_fim,
        versao: planejamento.versao,
        status:
          planejamento.status === "vigente" ||
          planejamento.status === "arquivado"
            ? planejamento.status
            : "rascunho",
        observacao: planejamento.observacao ?? "",
      });
    } else {
      form.reset({
        centro_custo_id: centroCustoIdPadrao ?? "",
        periodo_inicio: "",
        periodo_fim: "",
        versao: 1,
        status: "rascunho",
        observacao: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, planejamento?.id, centroCustoIdPadrao]);

  const ccOptions = useMemo(
    () =>
      centrosCusto.map((cc) => ({
        value: cc.id,
        label: cc.codigo_centro_custo
          ? `${cc.codigo_centro_custo} — ${cc.nome_centro_custo}`
          : cc.nome_centro_custo,
      })),
    [centrosCusto]
  );

  const ccDisabled = mode === "edit" || !!centroCustoIdPadrao;
  const observacaoLen = (form.watch("observacao") ?? "").length;

  // Opções de status conforme modo
  const statusOptions: Array<{ value: PlanejamentoFormValues["status"]; label: string; disabled?: boolean }> =
    mode === "create"
      ? [
          { value: "rascunho", label: "Rascunho" },
          {
            value: "vigente",
            label: "Vigente",
            disabled: haVigenteOutro,
          },
        ]
      : [
          { value: "rascunho", label: "Rascunho" },
          {
            value: "vigente",
            label: "Vigente",
            disabled:
              haVigenteOutro && planejamento?.status !== "vigente",
          },
          { value: "arquivado", label: "Arquivado" },
        ];

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Criar planejamento manual de teste"
              : "Editar informações da versão"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Recurso administrativo temporário. O fluxo definitivo será via importação de cronograma (CSV, MS Project, Primavera)."
              : "Esta edição altera apenas os dados gerais da versão do planejamento. As atividades importadas serão ajustadas em uma fase posterior."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Centro de Custo</Label>
            <Combobox
              options={ccOptions}
              value={form.watch("centro_custo_id")}
              onChange={(v) => form.setValue("centro_custo_id", v, { shouldValidate: true })}
              placeholder="Selecione o Centro de Custo"
              searchPlaceholder="Buscar Centro de Custo..."
              disabled={ccDisabled}
            />
            {form.formState.errors.centro_custo_id && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.centro_custo_id.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="periodo_inicio">Período início</Label>
              <Input
                id="periodo_inicio"
                type="date"
                {...form.register("periodo_inicio")}
              />
              {form.formState.errors.periodo_inicio && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.periodo_inicio.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="periodo_fim">Período fim</Label>
              <Input
                id="periodo_fim"
                type="date"
                {...form.register("periodo_fim")}
              />
              {form.formState.errors.periodo_fim && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.periodo_fim.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="versao">Versão</Label>
              <Input
                id="versao"
                type="number"
                min={1}
                step={1}
                {...form.register("versao")}
              />
              {form.formState.errors.versao && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.versao.message}
                </p>
              )}
            </div>
            <div>
              <Label>Origem</Label>
              <Input value="Manual" readOnly disabled />
            </div>
            <div>
              <Label>Status</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select
                        value={form.watch("status")}
                        onValueChange={(v) =>
                          form.setValue(
                            "status",
                            v as PlanejamentoFormValues["status"],
                            { shouldValidate: true }
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              disabled={opt.disabled}
                            >
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  {haVigenteOutro && (
                    <TooltipContent>
                      Já existe um planejamento vigente para este Centro de Custo.
                      Arquive-o antes de ativar outro.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="observacao">Observação</Label>
              <span className="text-xs text-muted-foreground">
                {observacaoLen}/500
              </span>
            </div>
            <Textarea
              id="observacao"
              rows={3}
              maxLength={500}
              {...form.register("observacao")}
            />
            {form.formState.errors.observacao && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.observacao.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanejamentoFormDialog;
