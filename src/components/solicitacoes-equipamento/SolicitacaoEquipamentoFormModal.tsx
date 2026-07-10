import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SolicitacaoEquipamentoInsert, getAprovadorByCentroCusto, getUsuariosOperacionais, updateSolicitacaoEquipamento, type AprovadorCentroCusto, type SolicitacaoEquipamento, type SolicitacaoUpdatePatch } from "@/services/solicitacaoEquipamentoService";
import { getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, Package, ChevronRight, ChevronLeft, Check, Info, AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ItemBuilderSubForm from "./ItemBuilderSubForm";
import { SolicitacaoItemInsert, REGIME_LABELS, RegimeTrabalho } from "@/services/solicitacaoItensService";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatItemDisplay, isNaoCadastrado } from "@/utils/solicitacaoItemDisplay";
import { formatDateBR } from "@/utils/formatDateBR";


const schema = z.object({
  centro_custo_id: z.string().min(1, "Centro de custo é obrigatório"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  prioridade: z.enum(["NORMAL", "ALTA", "URGENTE"]).default("NORMAL"),
  justificativa: z.string().min(1, "Justificativa é obrigatória"),
  engenheiro_solicitante_id: z.string().min(1, "Engenheiro solicitante é obrigatório"),
  apontador_responsavel_id: z.string().min(1, "Apontador responsável é obrigatório"),
});

type FormValues = z.infer<typeof schema>;
type Step = "dados" | "itens" | "revisao";
type ItemWithDisplay = SolicitacaoItemInsert & { _displayName?: string };

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: "itens", label: "Itens", number: 1 },
  { key: "dados", label: "Dados", number: 2 },
  { key: "revisao", label: "Revisão", number: 3 },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SolicitacaoEquipamentoInsert, itens: SolicitacaoItemInsert[]) => Promise<void>;
  isSubmitting: boolean;
  initialCentroCustoId?: string | null;
  initialOrigem?: "planejamento_macro" | null;
  initialTipoEquipamentoId?: string | null;
  initialSubcategoriaId?: string | null;
  initialCategoriaLabel?: string | null;
  initialCategoriaMatch?: string[];
  initialStep?: Step;
  mode?: "create" | "edit";
  initialData?: SolicitacaoEquipamento | null;
  onUpdated?: () => void;
}

const SolicitacaoEquipamentoFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, isSubmitting, initialCentroCustoId, initialOrigem, initialTipoEquipamentoId, initialSubcategoriaId, initialCategoriaLabel, initialCategoriaMatch, initialStep, mode = "create", initialData = null, onUpdated }) => {
  const isEdit = mode === "edit" && !!initialData;

  const { toast } = useToast();
  const [step, setStep] = useState<Step>(initialStep ?? "itens");
  const [ccPreenchidoAuto, setCcPreenchidoAuto] = useState(false);
  const [ccSugeridoNaoEncontrado, setCcSugeridoNaoEncontrado] = useState(false);
  const [categoriaLabel, setCategoriaLabel] = useState<string | null>(initialCategoriaLabel ?? null);
  const [categoriaMatch, setCategoriaMatch] = useState<string[]>(initialCategoriaMatch ?? []);
  const [subcategoriaSugerida, setSubcategoriaSugerida] = useState<string | null>(initialSubcategoriaId ?? null);
  const [isSubmitLocal, setIsSubmitLocal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const limparFiltroCategoria = () => {
    setCategoriaLabel(null);
    setCategoriaMatch([]);
    setSubcategoriaSugerida(null);
  };

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros-custo-dropdown"],
    queryFn: getCentrosCustoDropdown,
  });

  // Usuários operacionais (só quem tem profile vinculado). value = profiles.id.
  const { data: allUsuarios = [] } = useQuery({
    queryKey: ['usuarios-operacionais-solic-equip'],
    queryFn: getUsuariosOperacionais,
  });

  const engenheiros = useMemo(() =>
    allUsuarios.filter((u) => {
      const funcao = (u.funcao_nome || '').toLowerCase();
      return funcao.includes('engenheiro') || funcao.includes('gerente regional');
    }),
    [allUsuarios]
  );

  const funcionarios = allUsuarios; // todos os operacionais elegíveis servem como apontador


  const [itens, setItens] = useState<ItemWithDisplay[]>([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itensError, setItensError] = useState("");
  const sugestaoAplicadaRef = useRef(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      centro_custo_id: "",
      data_inicio: "",
      prioridade: "NORMAL",
      justificativa: "",
      engenheiro_solicitante_id: "",
      apontador_responsavel_id: "",
    },
  });

  const centroCustoId = form.watch("centro_custo_id");

  const aprovadorQuery = useQuery({
    queryKey: ['aprovador-cc', centroCustoId],
    queryFn: () => getAprovadorByCentroCusto(centroCustoId!),
    enabled: !!centroCustoId,
    staleTime: 30_000,
  });
  const aprovadorInfo: AprovadorCentroCusto | null | undefined = aprovadorQuery.data;
  const aprovadorLoading = !!centroCustoId && (aprovadorQuery.isLoading || aprovadorQuery.isFetching) && !aprovadorInfo;
  const aprovadorInvalido = !aprovadorLoading && (aprovadorInfo === null || aprovadorInfo === undefined || aprovadorInfo?.sem_profile === true || !aprovadorInfo?.id);
  const aprovadorMotivo: string = (() => {
    if (!centroCustoId) return "Selecione um centro de custo.";
    if (aprovadorLoading) return "Carregando aprovador…";
    if (aprovadorInfo === null || aprovadorInfo === undefined) return "Centro de custo sem aprovador definido. Configure o aprovador do CC antes de criar a solicitação.";
    if (aprovadorInfo.sem_profile) return "Centro de custo sem aprovador com usuário vinculado. Vincule o aprovador ao usuário/profile antes de criar a solicitação.";
    return "";
  })();


  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setItens([]);
      setShowSubForm(false);
      setEditingIndex(null);
      setItensError("");
      setSubmitError(null);
      setIsSubmitLocal(false);
      setStep(initialStep ?? "itens");
      setCcPreenchidoAuto(false);
      setCcSugeridoNaoEncontrado(false);
      sugestaoAplicadaRef.current = false;
      setCategoriaLabel(initialCategoriaLabel ?? null);
      setCategoriaMatch(initialCategoriaMatch ?? []);
      setSubcategoriaSugerida(initialSubcategoriaId ?? null);
    } else if (isEdit && initialData) {
      // Hidrata form em modo edição
      form.reset({
        centro_custo_id: initialData.centro_custo_id ?? "",
        data_inicio: initialData.data_inicio ?? "",
        prioridade: (initialData.prioridade as any) ?? "NORMAL",
        justificativa: initialData.justificativa ?? "",
        engenheiro_solicitante_id: initialData.engenheiro_solicitante_id ?? "",
        apontador_responsavel_id: initialData.apontador_responsavel_id ?? "",
      });
      // Itens read-only (para exibição na etapa Itens)
      const readOnlyItens: ItemWithDisplay[] = (initialData.itens ?? []).map((it: any) => ({
        tipo_item: "EQUIPAMENTO",
        catalogo_equipamento_id: it.catalogo_equipamento_id ?? null,
        subcategoria_id: it.subcategoria_id ?? null,
        item_nao_catalogado: !!it.item_nao_catalogado,
        descricao_livre: it.descricao_livre ?? null,
        capacidade_descricao: it.capacidade_descricao ?? null,
        capacidade_valor: it.capacidade_valor ?? null,
        capacidade_unidade: it.capacidade_unidade ?? null,
        quantidade: it.quantidade ?? 1,
        _displayName: formatItemDisplay(it),
      })) as any;
      setItens(readOnlyItens);
      setShowSubForm(false);
      setEditingIndex(null);
      setItensError("");
      setSubmitError(null);
      setIsSubmitLocal(false);
      setStep(initialStep ?? "dados");
    } else {
      // Sincroniza filtro/categoria ao abrir (cada abertura reflete o card clicado)
      setStep(initialStep ?? "itens");
      setCategoriaLabel(initialCategoriaLabel ?? null);
      setCategoriaMatch(initialCategoriaMatch ?? []);
      setSubcategoriaSugerida(initialSubcategoriaId ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Pré-preenche Centro de Custo a partir do Planejamento Macro — UMA ÚNICA VEZ por abertura
  // e nunca sobrescreve escolha manual do usuário.
  useEffect(() => {
    if (!isOpen) return;
    if (initialOrigem !== "planejamento_macro") return;
    if (!initialCentroCustoId) return;
    if (centrosCusto.length === 0) return;
    if (sugestaoAplicadaRef.current) return;
    if (form.getValues("centro_custo_id")) return;

    const existe = centrosCusto.some((cc: any) => cc.id === initialCentroCustoId);
    if (existe) {
      form.setValue("centro_custo_id", initialCentroCustoId, { shouldValidate: true });
      setCcPreenchidoAuto(true);
      setCcSugeridoNaoEncontrado(false);
    } else {
      setCcPreenchidoAuto(false);
      setCcSugeridoNaoEncontrado(true);
    }
    sugestaoAplicadaRef.current = true;
  }, [isOpen, initialOrigem, initialCentroCustoId, centrosCusto]);

  const ccOptions = useMemo(() =>
    centrosCusto.map((cc) => ({
      value: cc.id,
      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
    })),
    [centrosCusto]
  );

  const engenheiroOptions = useMemo(() =>
    engenheiros.map((e) => ({
      value: e.profile_id, // FK-safe: profiles.id
      label: e.nome_completo || "Sem nome",
    })),
    [engenheiros]
  );

  const funcionarioOptions = useMemo(() =>
    funcionarios.map((f) => ({
      value: f.profile_id, // FK-safe: profiles.id
      label: f.nome_completo || "Sem nome",
    })),
    [funcionarios]
  );


  const handleAddItem = (item: ItemWithDisplay) => {
    if (editingIndex !== null) {
      setItens((prev) => prev.map((it, i) => (i === editingIndex ? item : it)));
      setEditingIndex(null);
    } else {
      setItens((prev) => [...prev, item]);
    }
    setShowSubForm(false);
    setItensError("");
  };

  const handleRemoveItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditItem = (index: number) => {
    setEditingIndex(index);
    setShowSubForm(true);
  };

  const getItemDisplayName = (item: ItemWithDisplay) => formatItemDisplay(item as any);


  // Step navigation — ordem: Itens → Dados → Revisão
  const handleNextStep = async () => {
    if (step === "itens") {
      if (itens.length === 0) {
        setItensError("Adicione pelo menos 1 item à solicitação");
        return;
      }
      setStep("dados");
    } else if (step === "dados") {
      const valid = await form.trigger();
      if (!valid) return;
      if (aprovadorLoading) {
        toast({ title: "Aguarde", description: "Carregando aprovador do centro de custo…" });
        return;
      }
      if (aprovadorInvalido) {
        setSubmitError(aprovadorMotivo);
        toast({ title: "Aprovador inválido", description: aprovadorMotivo, variant: "destructive" });
        return;
      }
      setSubmitError(null);
      setStep("revisao");
    }
  };

  const handlePrevStep = () => {
    if (step === "dados") setStep("itens");
    else if (step === "revisao") setStep("dados");
  };

  const buildFriendlyError = (error: any): string => {
    const code = error?.code;
    const message: string = error?.message ?? "";
    const details: string = error?.details ?? "";
    const hay = `${message} ${details}`.toLowerCase();
    if (code === "APROVADOR_SEM_PROFILE") {
      return message || "Centro de custo sem aprovador com usuário vinculado.";
    }
    if (code === "23503" && hay.includes("apontador_responsavel_id") && hay.includes("profiles")) {
      return "O apontador selecionado não possui usuário/profile vinculado no sistema. Selecione outro apontador ou solicite ao TI o vínculo deste funcionário ao usuário.";
    }
    if (code === "23503" && hay.includes("engenheiro_solicitante_id") && hay.includes("profiles")) {
      return "O engenheiro solicitante selecionado não possui usuário/profile vinculado no sistema. Selecione outro engenheiro ou solicite ao TI o vínculo deste funcionário ao usuário.";
    }
    if (code === "23503" && hay.includes("aprovador_centro_custo_id") && hay.includes("profiles")) {
      return "Centro de custo sem aprovador com usuário vinculado. Vincule o aprovador ao usuário/profile antes de criar a solicitação.";
    }
    return message || "Não foi possível salvar a solicitação.";
  };


  const handleFinalSubmit = async () => {
    console.log("[SOLIC_EQUIP][SUBMIT_CLICK]", { step, itens: itens.length });
    if (isSubmitLocal || isSubmitting) return;

    if (itens.length === 0) {
      console.warn("[SOLIC_EQUIP][SUBMIT_BLOCKED_NO_ITEMS]");
      setItensError("Adicione pelo menos 1 item à solicitação");
      setStep("itens");
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos 1 item antes de solicitar.",
        variant: "destructive",
      });
      return;
    }
    // Defesa: nenhum item pode ter item_nao_catalogado=false sem catalogo_equipamento_id.
    const inconsistente = itens.find((i) => !i.item_nao_catalogado && !i.catalogo_equipamento_id);
    if (inconsistente) {
      console.warn("[SOLIC_EQUIP][SUBMIT_BLOCKED_ITEM_INCONSISTENTE]", inconsistente);
      setStep("itens");
      setItensError("Há item inconsistente (sem catálogo e sem marca de não cadastrado). Edite e ajuste antes de solicitar.");
      toast({
        title: "Item inconsistente",
        description: "Reabra o item, informe subcategoria+capacidade ou descrição, e salve novamente.",
        variant: "destructive",
      });
      return;
    }

    // EDIT MODE — atualiza apenas cabeçalho via whitelist
    if (isEdit && initialData) {
      const valid = await form.trigger();
      if (!valid) {
        setStep("dados");
        toast({ title: "Dados incompletos", description: "Revise os dados obrigatórios.", variant: "destructive" });
        return;
      }
      const values = form.getValues();
      const patch: SolicitacaoUpdatePatch = {
        centro_custo_id: values.centro_custo_id,
        data_inicio: values.data_inicio,
        prioridade: values.prioridade as any,
        justificativa: values.justificativa,
        engenheiro_solicitante_id: values.engenheiro_solicitante_id,
        apontador_responsavel_id: values.apontador_responsavel_id,
      };
      try {
        setIsSubmitLocal(true);
        setSubmitError(null);
        await updateSolicitacaoEquipamento(initialData.id, patch);
        toast({ title: "Solicitação atualizada" });
        onUpdated?.();
        onClose();
      } catch (error: any) {
        console.error("[SOLIC_EQUIP][UPDATE_ERROR]", error);
        const friendly = buildFriendlyError(error);
        setSubmitError(friendly);
        toast({ title: "Erro ao atualizar solicitação", description: friendly, variant: "destructive" });
      } finally {
        setIsSubmitLocal(false);
      }
      return;
    }

    const valid = await form.trigger();

    if (!valid) {
      console.warn("[SOLIC_EQUIP][SUBMIT_BLOCKED_INVALID_FORM]", form.formState.errors);
      setStep("dados");
      toast({
        title: "Dados incompletos",
        description: "Revise os dados obrigatórios da solicitação.",
        variant: "destructive",
      });
      return;
    }
    if (aprovadorLoading) {

      toast({ title: "Aguarde", description: "Carregando aprovador do centro de custo…" });
      return;
    }
    if (aprovadorInvalido) {
      setStep("dados");
      setSubmitError(aprovadorMotivo);
      toast({ title: "Aprovador inválido", description: aprovadorMotivo, variant: "destructive" });
      return;
    }

    const values = form.getValues();
    const solicitacao: SolicitacaoEquipamentoInsert = {
      centro_custo_id: values.centro_custo_id,
      // tipo_equipamento_id representa a CATEGORIA INICIAL escolhida pelo card,
      // não trava os itens (o usuário pode adicionar qualquer subcategoria).
      tipo_equipamento_id: initialTipoEquipamentoId ?? null,
      quantidade: itens.reduce((acc, i) => acc + i.quantidade, 0),
      data_inicio: values.data_inicio,
      prioridade: values.prioridade as "NORMAL" | "ALTA" | "URGENTE",
      justificativa: values.justificativa,
      engenheiro_solicitante_id: values.engenheiro_solicitante_id,
      apontador_responsavel_id: values.apontador_responsavel_id,
    };
    const cleanItens: SolicitacaoItemInsert[] = itens.map(({ _displayName, ...rest }) => rest);
    try {
      setIsSubmitLocal(true);
      setSubmitError(null);
      console.log("[SOLIC_EQUIP][SUBMIT_START]", { solicitacao, itens: cleanItens.length });
      await onSubmit(solicitacao, cleanItens);
      console.log("[SOLIC_EQUIP][SUBMIT_SUCCESS]");
    } catch (error: any) {
      console.error("[SOLIC_EQUIP][SUBMIT_ERROR]", error);
      const friendly = buildFriendlyError(error);
      setSubmitError(friendly);
      toast({
        title: "Erro ao solicitar equipamento",
        description: friendly,
        variant: "destructive",
      });
      // Não rethrow — evita unhandled rejection.
    } finally {
      setIsSubmitLocal(false);
    }
  };


  // Helpers for review
  const getLabel = (options: { value: string; label: string }[], value: string) =>
    options.find((o) => o.value === value)?.label || "—";

  const prioridadeLabel: Record<string, string> = { NORMAL: "Normal", ALTA: "Alta", URGENTE: "Urgente" };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Solicitação de Equipamento" : "Nova Solicitação de Equipamento"}</DialogTitle>
          <DialogDescription>
            Preencha os dados, adicione os itens e revise antes de solicitar.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.key}>
              {idx > 0 && <div className="flex-1 h-px bg-border" />}
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                  step === s.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : STEPS.findIndex((x) => x.key === step) > idx
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {STEPS.findIndex((x) => x.key === step) > idx ? <Check className="h-3.5 w-3.5" /> : s.number}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden sm:block",
                  step === s.key ? "text-foreground" : "text-muted-foreground"
                )}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            {/* STEP 1 — Dados */}
            {step === "dados" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="centro_custo_id" render={({ field }) => {
                  const ccBloqueadoPorOrigem = initialOrigem === "planejamento_macro" && ccPreenchidoAuto;
                  return (
                    <FormItem className="col-span-2">
                      <FormLabel>Centro de Custo *</FormLabel>
                      <FormControl>
                        <Combobox
                          options={ccOptions}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione o centro de custo"
                          searchPlaceholder="Buscar..."
                          emptyText="Nenhum encontrado"
                          disabled={ccBloqueadoPorOrigem}
                        />
                      </FormControl>
                      {ccBloqueadoPorOrigem && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Info className="h-3.5 w-3.5 text-primary" />
                          Centro de Custo definido pelo Planejamento Macro. Para solicitar para outro Centro de Custo, inicie uma nova solicitação pelo fluxo normal.
                        </p>
                      )}
                      {ccSugeridoNaoEncontrado && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive mt-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Não foi possível aplicar automaticamente o Centro de Custo informado pelo Planejamento Macro. Selecione manualmente.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }} />

                {centroCustoId && (
                  <div className={cn(
                    "col-span-2 flex items-start gap-2 rounded-md border p-3",
                    aprovadorInvalido ? "border-amber-300 bg-amber-50 text-amber-900" : "border-dashed bg-muted/30"
                  )}>
                    <Shield className={cn("h-4 w-4 mt-0.5", aprovadorInvalido ? "text-amber-700" : "text-primary")} />
                    <div className="text-sm">
                      {aprovadorLoading ? (
                        <span className="text-muted-foreground">Carregando aprovador…</span>
                      ) : aprovadorInvalido ? (
                        <span>{aprovadorMotivo}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Aprovador: <strong className="text-foreground">{aprovadorInfo?.nome}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}


                <FormField control={form.control} name="engenheiro_solicitante_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engenheiro Solicitante *</FormLabel>
                    <FormControl>
                      <Combobox options={engenheiroOptions} value={field.value} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar engenheiro..." emptyText="Nenhum engenheiro encontrado" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Somente pessoas com usuário vinculado no sistema aparecem aqui.</p>
                    <FormMessage />
                  </FormItem>
                )} />


                <FormField control={form.control} name="apontador_responsavel_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apontador (Resp. Campo) *</FormLabel>
                    <FormControl>
                      <Combobox options={funcionarioOptions} value={field.value} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar funcionário..." emptyText="Nenhum encontrado" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">Somente pessoas com usuário vinculado no sistema aparecem aqui.</p>
                    <FormMessage />
                  </FormItem>
                )} />


                <FormField control={form.control} name="data_inicio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="prioridade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade *</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="ALTA">Alta</SelectItem>
                          <SelectItem value="URGENTE">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="justificativa" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Justificativa *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva a necessidade" className="min-h-[60px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* STEP 1 — Itens */}
            {step === "itens" && (
              <div className="space-y-3">
                {categoriaLabel && categoriaMatch.length > 0 && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Info className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Filtro ativo:</span>
                      <strong className="text-foreground">{categoriaLabel}</strong>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={limparFiltroCategoria}>
                      <X className="h-3.5 w-3.5 mr-1" /> Mostrar todos
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Itens da Solicitação</h3>
                  {!showSubForm && !isEdit && (
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowSubForm(true); setEditingIndex(null); }}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                    </Button>
                  )}
                </div>

                {isEdit && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    Nesta fase, a edição altera apenas os dados principais (cabeçalho). Para alterar itens, cancele esta solicitação e crie uma nova.
                  </div>
                )}

                {itensError && <p className="text-sm text-destructive">{itensError}</p>}

                {itens.length > 0 && (
                  <div className="space-y-2">
                    {itens.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 p-3 border rounded-md bg-background">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{getItemDisplayName(item)}</p>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-xs">{item.tipo_item}</Badge>
                              <Badge variant="outline" className="text-xs">Qtd: {item.quantidade}</Badge>
                              {item.com_operador && <Badge variant="outline" className="text-xs">C/ Operador</Badge>}
                              {item.regime_trabalho && <Badge variant="outline" className="text-xs">{REGIME_LABELS[item.regime_trabalho as RegimeTrabalho] || item.regime_trabalho}</Badge>}
                              {isNaoCadastrado(item as any) && <Badge variant="destructive" className="text-xs">Não cadastrado</Badge>}
                            </div>

                          </div>
                        </div>
                        {!isEdit && (
                          <div className="flex gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleEditItem(idx)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showSubForm && (
                  <ItemBuilderSubForm
                    onAdd={handleAddItem}
                    onCancel={() => { setShowSubForm(false); setEditingIndex(null); }}
                    editingItem={editingIndex !== null ? itens[editingIndex] : null}
                    initialSubcategoriaId={editingIndex === null ? subcategoriaSugerida : null}
                    categoriaMatch={categoriaMatch}
                    categoriaLabel={categoriaLabel}
                  />
                )}


                {itens.length === 0 && !showSubForm && (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhum item adicionado. Clique em "Adicionar Item".</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — Revisão */}
            {step === "revisao" && (
              <div className="space-y-4">
                <div className="border rounded-md p-4 space-y-2 bg-muted/20">
                  <h3 className="font-semibold text-sm mb-3">Dados da Solicitação</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Centro de Custo:</span>
                    <span className="font-medium">{getLabel(ccOptions, form.getValues("centro_custo_id"))}</span>
                    <span className="text-muted-foreground">Engenheiro:</span>
                    <span className="font-medium">{getLabel(engenheiroOptions, form.getValues("engenheiro_solicitante_id"))}</span>
                    <span className="text-muted-foreground">Apontador:</span>
                    <span className="font-medium">{getLabel(funcionarioOptions, form.getValues("apontador_responsavel_id"))}</span>
                    <span className="text-muted-foreground">Data Início:</span>
                    <span className="font-medium">{formatDateBR(form.getValues("data_inicio"))}</span>
                    <span className="text-muted-foreground">Prioridade:</span>
                    <span className="font-medium">{prioridadeLabel[form.getValues("prioridade")] || form.getValues("prioridade")}</span>
                    <span className="text-muted-foreground">Aprovador:</span>
                    <span className={cn("font-medium", aprovadorInvalido && "text-amber-700")}>
                      {aprovadorLoading ? "Carregando…" : aprovadorInvalido ? aprovadorMotivo : (aprovadorInfo?.nome || "Nenhum")}
                    </span>

                  </div>
                  <div className="pt-2">
                    <span className="text-muted-foreground text-sm">Justificativa:</span>
                    <p className="text-sm mt-1">{form.getValues("justificativa")}</p>
                  </div>
                </div>

                <div className="border rounded-md p-4 space-y-2 bg-muted/20">
                  <h3 className="font-semibold text-sm mb-3">Itens ({itens.length})</h3>
                  <div className="space-y-2">
                    {itens.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 border rounded bg-background">
                        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{getItemDisplayName(item)}</p>
                          <div className="flex gap-2 flex-wrap mt-0.5">
                            <Badge variant="secondary" className="text-xs">{item.tipo_item}</Badge>
                            <Badge variant="outline" className="text-xs">Qtd: {item.quantidade}</Badge>
                            {item.com_operador && <Badge variant="outline" className="text-xs">C/ Operador</Badge>}
                            {isNaoCadastrado(item as any) && <Badge variant="destructive" className="text-xs">Não cadastrado</Badge>}

                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Banner de erro inline (aparece em qualquer step após tentativa) */}
            {submitError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <strong>Erro ao salvar:</strong> {submitError}
              </div>
            )}

            {/* Footer navigation */}
            <DialogFooter className="flex justify-between sm:justify-between gap-2">
              <div>
                {step !== "itens" && (
                  <Button type="button" variant="outline" onClick={handlePrevStep} disabled={isSubmitting || isSubmitLocal}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting || isSubmitLocal}>Cancelar</Button>
                {step !== "revisao" ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={step === "dados" && !isEdit && (aprovadorLoading || aprovadorInvalido)}
                  >
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      console.log("[SOLIC_EQUIP][SUBMIT_BUTTON_CLICK]");
                      void handleFinalSubmit();
                    }}
                    disabled={isSubmitting || isSubmitLocal || (!isEdit && (aprovadorLoading || aprovadorInvalido))}
                  >
                    {(isSubmitting || isSubmitLocal) ? "Salvando..." : (isEdit ? "Salvar alterações" : "Solicitar")}
                  </Button>
                )}

              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SolicitacaoEquipamentoFormModal;
