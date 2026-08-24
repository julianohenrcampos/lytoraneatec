import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracaoSistema } from "@/hooks/useConfiguracaoSistema";
import { AlertCircle } from "lucide-react";
import { fetchVeiculos } from "@/services/veiculo/queries";
import { getUsuariosOperacionais } from "@/services/solicitacaoEquipamentoService";
import { useAuth } from "@/hooks/useAuth";
import { solicitarDesmobilizacao } from "@/services/desmobilizacaoService";
import { DESMOBILIZACAO_INVALIDATE_KEYS } from "./desmobilizacaoQueryKeys";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  veiculoId: string;
  engResponsavelId: string;
  engSolicitanteId: string;
  dataRetirada: string;
  horaRetirada: string;
  observacoes: string;
};

const INITIAL: FormState = {
  veiculoId: "",
  engResponsavelId: "",
  engSolicitanteId: "",
  dataRetirada: "",
  horaRetirada: "",
  observacoes: "",
};

const isEngenheiroOuGerente = (funcao: string): boolean => {
  const f = (funcao || "").toLowerCase();
  return f.includes("engenheiro") || f.includes("gerente regional");
};

const NovaDesmobilizacaoModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { data: aprovacaoDesmobilizacaoRaw, isLoading: aprovacaoDesmobilizacaoLoading } =
    useConfiguracaoSistema('veic_equip_exige_aprovacao_desmobilizacao');
  const exigeAprovacaoDesmobilizacao = aprovacaoDesmobilizacaoLoading
    ? null
    : aprovacaoDesmobilizacaoRaw === 'true';
  const [form, setForm] = useState<FormState>(INITIAL);

  const { data: veiculos = [] } = useQuery({
    queryKey: ["desm-veiculos"],
    queryFn: () => fetchVeiculos({}),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: engenheiros = [] } = useQuery({
    queryKey: ["desm-eng"],
    queryFn: getUsuariosOperacionais,
    enabled: open,
    staleTime: 60_000,
  });

  const engenheirosFiltrados = useMemo(
    () => engenheiros.filter((u) => isEngenheiroOuGerente(u.funcao_nome)),
    [engenheiros]
  );

  useEffect(() => {
    if (!open) return;
    if (form.engSolicitanteId || !userId) return;
    if (engenheirosFiltrados.some((e) => e.profile_id === userId)) {
      setForm((p) => ({ ...p, engSolicitanteId: userId }));
    }
  }, [open, userId, engenheirosFiltrados, form.engSolicitanteId]);

  useEffect(() => {
    if (!open) setForm(INITIAL);
  }, [open]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleClose = () => {
    setForm(INITIAL);
    onOpenChange(false);
  };

  const veiculoSelecionado = useMemo(
    () => veiculos.find((v) => v.id === form.veiculoId),
    [veiculos, form.veiculoId]
  );
  const ccAtualNome = veiculoSelecionado?.nome_centro_custo || "";

  const veiculoOptions: ComboboxOption[] = useMemo(
    () =>
      veiculos.map((v) => {
        const frota = [v.frota, v.numero_frota].filter(Boolean).join(" ");
        const placa = v.placa || "s/ placa";
        const label = frota ? `${frota} - ${placa}` : placa;
        return {
          value: v.id,
          label,
          searchText: `${frota} ${placa} ${v.nome_categoria ?? ""} ${v.nome_subcategoria ?? ""}`.trim(),
        };
      }),
    [veiculos]
  );

  const engOptions: ComboboxOption[] = useMemo(
    () =>
      engenheirosFiltrados.map((u) => ({
        value: u.profile_id,
        label: `${u.nome_completo}${u.funcao_nome ? ` — ${u.funcao_nome}` : ""}`,
        searchText: `${u.nome_completo} ${u.funcao_nome}`,
      })),
    [engenheirosFiltrados]
  );

  const hojeBrt = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
    []
  );

  const semCentroCusto = !!form.veiculoId && !ccAtualNome;
  const dataRetroativa = !!form.dataRetirada && form.dataRetirada < hojeBrt;

  const solicitarMutation = useMutation({
    mutationFn: () =>
      solicitarDesmobilizacao({
        equipamentoId: form.veiculoId,
        engenheiroResponsavelId: form.engResponsavelId,
        engenheiroSolicitanteId: form.engSolicitanteId,
        dataRetirada: form.dataRetirada,
        horaRetirada: form.horaRetirada || null,
        observacoes: form.observacoes || null,
      }),
    onSuccess: (res) => {
      DESMOBILIZACAO_INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast({
        title: res.status === "APROVADA" ? "Desmobilização registrada" : "Enviada para aprovação",
        description:
          res.status === "APROVADA"
            ? "A previsão de liberação do ativo foi atualizada. O ativo permanece Alocado no centro de custo atual."
            : "A solicitação aguarda aprovação. A disponibilidade do ativo só muda após a decisão.",
      });
      handleClose();
    },
    onError: (e: Error) =>
      toast({ title: "Não foi possível registrar", description: e.message, variant: "destructive" }),
  });

  const handleEnviar = () => {
    const faltando =
      !form.veiculoId ||
      !form.engResponsavelId ||
      !form.engSolicitanteId ||
      !form.dataRetirada;

    if (faltando) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha os campos obrigatórios da desmobilização.",
        variant: "destructive",
      });
      return;
    }

    if (semCentroCusto) {
      toast({
        title: "Ativo sem centro de custo",
        description: "Só é possível desmobilizar um ativo alocado a um centro de custo.",
        variant: "destructive",
      });
      return;
    }

    if (dataRetroativa) {
      toast({
        title: "Data inválida",
        description: "A data disponível para retirada não pode ser retroativa.",
        variant: "destructive",
      });
      return;
    }

    solicitarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Desmobilizar Veic/Equip</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {aprovacaoDesmobilizacaoLoading
              ? "A Central do Transporte executará a movimentação física após o registro."
              : exigeAprovacaoDesmobilizacao
              ? "Esta solicitação seguirá para aprovação. Aprovada, a data informada passa a ser a previsão de liberação do ativo — o centro de custo atual é mantido até a movimentação real."
              : "Aprovação desativada: ao enviar, a data informada passa imediatamente a ser a previsão de liberação do ativo. O centro de custo atual é mantido até a movimentação real."}
          </AlertDescription>
        </Alert>


        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Dados da Desmobilização</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Frota / número do equipamento *</Label>
                <Combobox
                  options={veiculoOptions}
                  value={form.veiculoId}
                  onChange={(v) => set("veiculoId", v)}
                  placeholder="Selecione o veículo/equipamento"
                  searchPlaceholder="Buscar por frota, placa..."
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Centro de custo atual</Label>
                <Input value={ccAtualNome || "Não identificado"} readOnly disabled />
                {form.veiculoId && !ccAtualNome && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Centro de custo atual não identificado. Não é possível desmobilizar um ativo
                      sem centro de custo de origem — regularize a alocação antes de solicitar.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Engenheiro responsável pela operação *</Label>
                <Combobox
                  options={engOptions}
                  value={form.engResponsavelId}
                  onChange={(v) => set("engResponsavelId", v)}
                  placeholder="Selecione o engenheiro"
                  searchPlaceholder="Buscar engenheiro..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Engenheiro solicitante *</Label>
                <Combobox
                  options={engOptions}
                  value={form.engSolicitanteId}
                  onChange={(v) => set("engSolicitanteId", v)}
                  placeholder="Selecione o solicitante"
                  searchPlaceholder="Buscar solicitante..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="des-data-ret">Data disponível para retirada *</Label>
                <Input
                  id="des-data-ret"
                  type="date"
                  min={hojeBrt}
                  value={form.dataRetirada}
                  onChange={(e) => set("dataRetirada", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="des-hora-ret">Hora disponível para retirada</Label>
                <Input
                  id="des-hora-ret"
                  type="time"
                  value={form.horaRetirada}
                  onChange={(e) => set("horaRetirada", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="des-obs">Observações</Label>
              <Textarea
                id="des-obs"
                placeholder="Informe observações relevantes para a Central do Transporte..."
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {form.observacoes.length}/500
              </p>
            </div>
          </section>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={solicitarMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={solicitarMutation.isPending || semCentroCusto || dataRetroativa}>
            {solicitarMutation.isPending ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaDesmobilizacaoModal;
