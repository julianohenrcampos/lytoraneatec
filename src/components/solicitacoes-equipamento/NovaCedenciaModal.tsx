import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracaoSistema } from "@/hooks/useConfiguracaoSistema";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchVeiculos } from "@/services/veiculo/queries";
import { getUsuariosOperacionais } from "@/services/solicitacaoEquipamentoService";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { RESTRICTED_CC_CODE } from "@/utils/centroCustoRestrictions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  veiculoId: string;
  ccDestinoId: string;
  engResponsavelId: string;
  engSolicitanteId: string;
  dataRetirada: string;
  horaRetirada: string;
  dataDevolucao: string;
  horaDevolucao: string;
};

const INITIAL: FormState = {
  veiculoId: "",
  ccDestinoId: "",
  engResponsavelId: "",
  engSolicitanteId: "",
  dataRetirada: "",
  horaRetirada: "",
  dataDevolucao: "",
  horaDevolucao: "",
};

const isEngenheiroOuGerente = (funcao: string): boolean => {
  const f = (funcao || "").toLowerCase();
  return f.includes("engenheiro") || f.includes("gerente regional");
};

const NovaCedenciaModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const { userId } = useAuth();
  const { isSuperAdmin } = usePermission();
  const { data: aprovacaoCedenciaRaw, isLoading: aprovacaoCedenciaLoading } = useConfiguracaoSistema(
    'veic_equip_exige_aprovacao_cedencia'
  );
  const exigeAprovacaoCedencia = aprovacaoCedenciaLoading ? null : aprovacaoCedenciaRaw === 'true';
  const [form, setForm] = useState<FormState>(INITIAL);

  const { data: veiculos = [] } = useQuery({
    queryKey: ["ced-veiculos"],
    queryFn: () => fetchVeiculos({}),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["ced-cc", isSuperAdmin],
    queryFn: async () => {
      let q = supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo")
        .eq("situacao", "Ativo");
      if (!isSuperAdmin) q = q.neq("codigo_centro_custo", RESTRICTED_CC_CODE);
      const { data, error } = await q.order("nome_centro_custo");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: engenheiros = [] } = useQuery({
    queryKey: ["ced-eng"],
    queryFn: getUsuariosOperacionais,
    enabled: open,
    staleTime: 60_000,
  });

  const engenheirosFiltrados = useMemo(
    () => engenheiros.filter((u) => isEngenheiroOuGerente(u.funcao_nome)),
    [engenheiros]
  );

  // Auto-preenche engenheiro solicitante quando logado é elegível
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
  const ccAtualId = veiculoSelecionado?.centro_custo_id || null;

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

  const ccOptions: ComboboxOption[] = useMemo(
    () =>
      centrosCusto.map((c: any) => ({
        value: c.id,
        label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}`,
        searchText: `${c.codigo_centro_custo} ${c.nome_centro_custo}`,
      })),
    [centrosCusto]
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

  const handleEnviar = () => {
    const faltando =
      !form.veiculoId ||
      !form.engResponsavelId ||
      !form.engSolicitanteId ||
      !form.ccDestinoId ||
      !form.dataRetirada ||
      !form.dataDevolucao;

    if (faltando) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha os campos obrigatórios da cedência.",
        variant: "destructive",
      });
      return;
    }

    const dataRetirada = new Date(form.dataRetirada + "T00:00:00");
    const dataDevolucao = new Date(form.dataDevolucao + "T00:00:00");

    if (dataDevolucao < dataRetirada) {
      toast({
        title: "Datas inválidas",
        description: "A data prevista de devolução não pode ser anterior à data de retirada.",
        variant: "destructive",
      });
      return;
    }

    if (ccAtualId && ccAtualId === form.ccDestinoId) {
      toast({
        title: "Destino inválido",
        description: "O centro de custo destino deve ser diferente do centro de custo atual.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Formulário validado",
      description:
        exigeAprovacaoCedencia === true
          ? "A cedência será enviada para aprovação quando a persistência for liberada."
          : "A cedência será enviada diretamente para a Central do Transporte quando a persistência for liberada.",
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ceder Veic/Equip</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {aprovacaoCedenciaLoading
              ? "Pré-formulário operacional. A Central do Transporte executará a decisão final."
              : exigeAprovacaoCedencia
              ? "Pré-formulário operacional. Após validação da modelagem, esta demanda seguirá para aprovação antes da Central do Transporte."
              : "Pré-formulário operacional. Após validação da modelagem, esta demanda seguirá diretamente para a Central do Transporte."}
          </AlertDescription>
        </Alert>

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Dados da Cedência</h3>
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
                      Centro de custo atual não identificado. A Central do Transporte deverá
                      validar a origem operacional.
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

              <div className="space-y-1.5 md:col-span-2">
                <Label>Centro de custo destino *</Label>
                <Combobox
                  options={ccOptions}
                  value={form.ccDestinoId}
                  onChange={(v) => set("ccDestinoId", v)}
                  placeholder="Selecione o centro de custo destino"
                  searchPlaceholder="Buscar por código ou nome..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ced-data-ret">Data disponível para retirada *</Label>
                <Input
                  id="ced-data-ret"
                  type="date"
                  value={form.dataRetirada}
                  onChange={(e) => set("dataRetirada", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ced-hora-ret">Hora disponível para retirada</Label>
                <Input
                  id="ced-hora-ret"
                  type="time"
                  value={form.horaRetirada}
                  onChange={(e) => set("horaRetirada", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ced-data-dev">Data prevista de devolução *</Label>
                <Input
                  id="ced-data-dev"
                  type="date"
                  value={form.dataDevolucao}
                  onChange={(e) => set("dataDevolucao", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ced-hora-dev">Hora prevista de devolução</Label>
                <Input
                  id="ced-hora-dev"
                  type="time"
                  value={form.horaDevolucao}
                  onChange={(e) => set("horaDevolucao", e.target.value)}
                />
              </div>
            </div>
          </section>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar}>Enviar para Central</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaCedenciaModal;
