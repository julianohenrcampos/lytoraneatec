/**
 * Modal ÚNICO de disponibilidade operacional (CREATE × EDIT).
 *
 * Grava exclusivamente por `fn_ct_disponibilidade_upsert`. Não envia `id`,
 * nem executa insert/update direto em bd_disponibilidade_equipamentos.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";
import {
  regularizarDisponibilidade,
  STATUS_OPERACIONAIS_EDITAVEIS,
  type ConfiabilidadePrevisao,
  type DisponibilidadeFormMode,
  type StatusOperacionalEditavel,
} from "@/services/centralTransporteDisponibilidadeService";
import { invalidarCachesAtivosOperacionais } from "@/lib/queryInvalidation/ativosOperacionais";
import { normalizeDisponibilidadeError } from "@/utils/ct2ErrorMapper";
import {
  BOTAO_POR_MODO,
  TITULO_POR_MODO,
  construirValoresIniciais,
  limparCamposIncompativeis,
  validarFormDisponibilidade,
  type ErrosFormDisponibilidade,
  type RegistroDisponibilidadeAtual,
  type ValoresFormDisponibilidade,
} from "./disponibilidadeFormLogic";

export const STATUS_LABELS: Record<StatusOperacionalEditavel, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
};

export interface DisponibilidadeUpsertModalProps {
  open: boolean;
  onClose: () => void;
  modo: DisponibilidadeFormMode;
  equipamentoId: string;
  identificacao: string;
  situacaoCadastral?: string | null;
  registroAtual: RegistroDisponibilidadeAtual | null;
  centroCustoIdSugerido?: string | null;
  onSuccess?: () => void;
}

const DisponibilidadeUpsertModal: React.FC<DisponibilidadeUpsertModalProps> = ({
  open,
  onClose,
  modo,
  equipamentoId,
  identificacao,
  situacaoCadastral,
  registroAtual,
  centroCustoIdSugerido,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [valores, setValores] = useState<ValoresFormDisponibilidade>(() => {
    const base = construirValoresIniciais(modo, registroAtual);
    return modo === "CREATE" && centroCustoIdSugerido
      ? { ...base, centroCustoId: centroCustoIdSugerido }
      : base;
  });
  const [erros, setErros] = useState<ErrosFormDisponibilidade>({});

  useEffect(() => {
    if (!open) return;
    const base = construirValoresIniciais(modo, registroAtual);
    setValores(
      modo === "CREATE" && centroCustoIdSugerido
        ? { ...base, centroCustoId: centroCustoIdSugerido }
        : base,
    );
    setErros({});
    // registroAtual é estável por abertura do modal
  }, [open, modo, registroAtual, centroCustoIdSugerido]);

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["cc-dd"],
    queryFn: getCentrosCustoDropdown,
    enabled: open,
  });

  const ccOptions = useMemo(
    () =>
      centrosCusto.map((c) => ({
        value: c.id,
        label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}`,
      })),
    [centrosCusto],
  );

  const set = <K extends keyof ValoresFormDisponibilidade>(
    campo: K,
    valor: ValoresFormDisponibilidade[K],
  ) => setValores((v) => ({ ...v, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => {
      const limpos = limparCamposIncompativeis(valores);
      return regularizarDisponibilidade({
        equipamentoId,
        statusOperacional: limpos.status as StatusOperacionalEditavel,
        centroCustoId: limpos.centroCustoId,
        dataInicio: limpos.dataInicio,
        previsaoLiberacao: limpos.previsaoLiberacao,
        confiabilidade: (limpos.confiabilidade || null) as ConfiabilidadePrevisao | null,
        motivoRisco: limpos.motivoRisco,
        observacao: limpos.observacao,
        modo,
      });
    },
    onSuccess: async (res) => {
      await invalidarCachesAtivosOperacionais(queryClient);
      toast({
        title: res.criou ? "Disponibilidade registrada" : "Disponibilidade atualizada",
        description: `${identificacao} — ${STATUS_LABELS[res.status_operacional] ?? res.status_operacional}. A análise foi recalculada.`,
      });
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const n = normalizeDisponibilidadeError(err);
      toast({ title: "Não foi possível salvar", description: n.message, variant: "destructive" });
    },
  });

  const submeter = () => {
    const limpos = limparCamposIncompativeis(valores);
    const validacao = validarFormDisponibilidade(limpos, equipamentoId);
    setErros(validacao);
    if (Object.keys(validacao).length > 0) return;
    setValores(limpos);
    mutation.mutate();
  };

  const exigeDetalhes = valores.status && valores.status !== "DISPONIVEL";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{TITULO_POR_MODO[modo]}</DialogTitle>
          <DialogDescription>
            {identificacao} — a situação cadastral{situacaoCadastral ? ` ("${situacaoCadastral}")` : ""} não é
            alterada por esta ação.
          </DialogDescription>
        </DialogHeader>

        {modo === "CREATE" && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este ativo não possui registro operacional. Sem essa confirmação humana ele não pode ser reservado
              nem atendido pela Central do Transporte.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Status operacional *</Label>
            <Select
              value={valores.status ?? undefined}
              onValueChange={(v) => set("status", v as StatusOperacionalEditavel)}
            >
              <SelectTrigger data-testid="ct2-regularizar-status">
                <SelectValue placeholder="Selecione o status operacional" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPERACIONAIS_EDITAVEIS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.status && <p className="text-xs text-destructive">{erros.status}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Centro de custo (opcional)</Label>
            <Combobox
              options={ccOptions}
              value={valores.centroCustoId}
              onChange={(v) => set("centroCustoId", v)}
              placeholder="Selecione o centro de custo"
            />
            {erros.centroCustoId && <p className="text-xs text-destructive">{erros.centroCustoId}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de início *</Label>
              <Input
                type="date"
                value={valores.dataInicio}
                onChange={(e) => set("dataInicio", e.target.value)}
              />
              {erros.dataInicio && <p className="text-xs text-destructive">{erros.dataInicio}</p>}
            </div>
            {exigeDetalhes && (
              <div className="space-y-1.5">
                <Label>Previsão de liberação</Label>
                <Input
                  type="date"
                  value={valores.previsaoLiberacao}
                  onChange={(e) => set("previsaoLiberacao", e.target.value)}
                />
                {erros.previsaoLiberacao && (
                  <p className="text-xs text-destructive">{erros.previsaoLiberacao}</p>
                )}
              </div>
            )}
          </div>

          {exigeDetalhes && (
            <>
              <div className="space-y-1.5">
                <Label>Confiabilidade da previsão</Label>
                <Select
                  value={valores.confiabilidade || undefined}
                  onValueChange={(v) => set("confiabilidade", v as ConfiabilidadePrevisao)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
                {erros.confiabilidade && <p className="text-xs text-destructive">{erros.confiabilidade}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Motivo / risco *</Label>
                <Input
                  value={valores.motivoRisco}
                  onChange={(e) => set("motivoRisco", e.target.value)}
                  placeholder="Ex.: aguardando peça"
                />
                {erros.motivoRisco && <p className="text-xs text-destructive">{erros.motivoRisco}</p>}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea
              rows={2}
              value={valores.observacao}
              onChange={(e) => set("observacao", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            data-testid="ct2-regularizar-salvar"
            onClick={submeter}
            disabled={!valores.status || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {BOTAO_POR_MODO[modo]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DisponibilidadeUpsertModal;
