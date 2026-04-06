import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SolicitacaoEquipamentoInsert, getAprovadorByCentroCusto } from "@/services/solicitacaoEquipamentoService";
import { getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, Package, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ItemBuilderSubForm from "./ItemBuilderSubForm";
import { SolicitacaoItemInsert, REGIME_LABELS, RegimeTrabalho } from "@/services/solicitacaoItensService";
import { cn } from "@/lib/utils";

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
  { key: "dados", label: "Dados", number: 1 },
  { key: "itens", label: "Itens", number: 2 },
  { key: "revisao", label: "Revisão", number: 3 },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SolicitacaoEquipamentoInsert, itens: SolicitacaoItemInsert[]) => Promise<void>;
  isSubmitting: boolean;
}

const SolicitacaoEquipamentoFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const [step, setStep] = useState<Step>("dados");

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros-custo-dropdown"],
    queryFn: getCentrosCustoDropdown,
  });

  // Engenheiros: apenas funcionários com função de engenheiro ou gerente regional
  const { data: engenheiros = [] } = useQuery({
    queryKey: ["engenheiros-dropdown"],
    queryFn: async () => {
      const result = await (supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, funcao:bd_funcoes(nome_funcao)") as any)
        .eq("ativo", true)
        .order("nome_completo");
      const data = result.data || [];
      if (!data) return [];
      return data.filter((f: any) => {
        const funcao = (f.funcao?.nome_funcao || "").toLowerCase();
        return funcao.includes("engenheiro") || funcao.includes("gerente regional");
      });
    },
  });

  // Apontadores: todos os funcionários ativos
  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-dropdown"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("bd_funcionarios")
        .select("id, nome_completo") as any)
        .eq("ativo", true)
        .order("nome_completo");
      return data || [];
    },
  });

  const [aprovadorNome, setAprovadorNome] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemWithDisplay[]>([]);
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itensError, setItensError] = useState("");

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

  useEffect(() => {
    if (!centroCustoId) {
      setAprovadorNome(null);
      return;
    }
    getAprovadorByCentroCusto(centroCustoId).then((result) => {
      setAprovadorNome(result?.nome || null);
    });
  }, [centroCustoId]);

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setItens([]);
      setShowSubForm(false);
      setEditingIndex(null);
      setItensError("");
      setStep("dados");
    }
  }, [isOpen]);

  const ccOptions = useMemo(() =>
    centrosCusto.map((cc) => ({
      value: cc.id,
      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
    })),
    [centrosCusto]
  );

  const engenheiroOptions = useMemo(() =>
    engenheiros.map((e: any) => ({
      value: e.id,
      label: e.nome_completo || "Sem nome",
    })),
    [engenheiros]
  );

  const funcionarioOptions = useMemo(() =>
    funcionarios.map((f: any) => ({
      value: f.id,
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

  const getItemDisplayName = (item: ItemWithDisplay) => {
    if (item.item_nao_catalogado) return item.descricao_livre || "Item não catalogado";
    return item._displayName || "Item do catálogo";
  };

  // Step navigation
  const handleNextStep = async () => {
    if (step === "dados") {
      const valid = await form.trigger();
      if (!valid) return;
      setStep("itens");
    } else if (step === "itens") {
      if (itens.length === 0) {
        setItensError("Adicione pelo menos 1 item à solicitação");
        return;
      }
      setStep("revisao");
    }
  };

  const handlePrevStep = () => {
    if (step === "itens") setStep("dados");
    else if (step === "revisao") setStep("itens");
  };

  const handleFinalSubmit = async () => {
    const values = form.getValues();
    const solicitacao: SolicitacaoEquipamentoInsert = {
      centro_custo_id: values.centro_custo_id,
      quantidade: itens.reduce((acc, i) => acc + i.quantidade, 0),
      data_inicio: values.data_inicio,
      prioridade: values.prioridade as "NORMAL" | "ALTA" | "URGENTE",
      justificativa: values.justificativa,
      engenheiro_solicitante_id: values.engenheiro_solicitante_id,
      apontador_responsavel_id: values.apontador_responsavel_id,
    };
    const cleanItens: SolicitacaoItemInsert[] = itens.map(({ _displayName, ...rest }) => rest);
    await onSubmit(solicitacao, cleanItens);
  };

  // Helpers for review
  const getLabel = (options: { value: string; label: string }[], value: string) =>
    options.find((o) => o.value === value)?.label || "—";

  const prioridadeLabel: Record<string, string> = { NORMAL: "Normal", ALTA: "Alta", URGENTE: "Urgente" };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Equipamento</DialogTitle>
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
                <FormField control={form.control} name="centro_custo_id" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Centro de Custo *</FormLabel>
                    <FormControl>
                      <Combobox options={ccOptions} value={field.value} onChange={field.onChange} placeholder="Selecione o centro de custo" searchPlaceholder="Buscar..." emptyText="Nenhum encontrado" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {centroCustoId && (
                  <div className="col-span-2 flex items-center gap-2 rounded-md border border-dashed p-3 bg-muted/30">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Aprovador: <strong className="text-foreground">{aprovadorNome || "Nenhum aprovador vinculado"}</strong>
                    </span>
                  </div>
                )}

                <FormField control={form.control} name="engenheiro_solicitante_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engenheiro Solicitante *</FormLabel>
                    <FormControl>
                      <Combobox options={engenheiroOptions} value={field.value} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar engenheiro..." emptyText="Nenhum engenheiro encontrado" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="apontador_responsavel_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apontador (Resp. Campo) *</FormLabel>
                    <FormControl>
                      <Combobox options={funcionarioOptions} value={field.value} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar funcionário..." emptyText="Nenhum encontrado" />
                    </FormControl>
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

            {/* STEP 2 — Itens */}
            {step === "itens" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Itens da Solicitação</h3>
                  {!showSubForm && (
                    <Button type="button" variant="outline" size="sm" onClick={() => { setShowSubForm(true); setEditingIndex(null); }}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                    </Button>
                  )}
                </div>

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
                              {item.item_nao_catalogado && <Badge variant="destructive" className="text-xs">Fora do catálogo</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleEditItem(idx)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(idx)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {showSubForm && (
                  <ItemBuilderSubForm
                    onAdd={handleAddItem}
                    onCancel={() => { setShowSubForm(false); setEditingIndex(null); }}
                    editingItem={editingIndex !== null ? itens[editingIndex] : null}
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
                    <span className="font-medium">{form.getValues("data_inicio")}</span>
                    <span className="text-muted-foreground">Prioridade:</span>
                    <span className="font-medium">{prioridadeLabel[form.getValues("prioridade")] || form.getValues("prioridade")}</span>
                    <span className="text-muted-foreground">Aprovador:</span>
                    <span className="font-medium">{aprovadorNome || "Nenhum"}</span>
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer navigation */}
            <DialogFooter className="flex justify-between sm:justify-between gap-2">
              <div>
                {step !== "dados" && (
                  <Button type="button" variant="outline" onClick={handlePrevStep} disabled={isSubmitting}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                {step !== "revisao" ? (
                  <Button type="button" onClick={handleNextStep}>
                    Próximo <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleFinalSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Salvando..." : "Solicitar"}
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
