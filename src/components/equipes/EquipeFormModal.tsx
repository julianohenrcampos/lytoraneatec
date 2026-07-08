import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createEquipe, updateEquipe } from "@/services/equipe";
import { supabase } from "@/integrations/supabase/client";

import { fetchEquipeMembers, type EquipeMember } from "@/services/equipe/fetchEquipeMembers";
import { useFuncionariosBuscaAtivos } from "@/hooks/diarias/useFuncionariosBuscaAtivos";
import { useToast } from "@/hooks/use-toast";
import { Equipe, EquipeFormData } from "@/types/equipe";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, X, UserCheck, UserCog, Users, Tag, Search, Loader2, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EquipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipe?: Equipe;
  encarregados: any[];
  apontadores: any[];
}

const formSchema = z.object({
  nome_equipe: z.string().min(1, { message: "Nome da equipe é obrigatório" }),
  encarregado_id: z.string().min(1, { message: "Encarregado é obrigatório" }),
  apontador_id: z.string().min(1, { message: "Apontador é obrigatório" }),
  equipe: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

const norm = (s?: string | null) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getFuncNome = (f: any): string =>
  f?.funcao_nome ?? f?.bd_funcoes?.nome_funcao ?? "";


const TOAST_OUTRA_EQUIPE = {
  title: "Funcionário já pertence a outra equipe",
  description:
    "Este funcionário já pertence a outra equipe. Para transferi-lo, use a ação Transferir Membros na tabela de equipes.",
  variant: "destructive" as const,
};

const EquipeFormModal: React.FC<EquipeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  equipe,
  encarregados,
  apontadores,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, { nome_completo: string; equipe_id: string | null; funcao_nome?: string | null }>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [searchEnc, setSearchEnc] = useState("");
  const [searchAp, setSearchAp] = useState("");
  const [encOpen, setEncOpen] = useState(false);
  const [apOpen, setApOpen] = useState(false);
  const membrosManuaisRef = useRef<Set<string>>(new Set());

  // Carregar membros existentes (edição) via fetchEquipeMembers
  const { data: existingMembers = [], isLoading: isLoadingMembers } = useQuery<EquipeMember[]>({
    queryKey: ["equipe-members", equipe?.id],
    queryFn: () => fetchEquipeMembers(equipe!.id),
    enabled: !!equipe?.id && isOpen,
    staleTime: 30_000,
  });

  // Busca sob demanda (>= 2 chars) — membros
  const enabledSearch = searchTerm.trim().length >= 2;
  const { funcionarios: searchResults, isFetching: isSearching } = useFuncionariosBuscaAtivos({
    search: searchTerm,
    limit: 30,
    enabled: enabledSearch,
  });

  // Busca sob demanda — encarregado
  const enabledEnc = searchEnc.trim().length >= 2;
  const { funcionarios: encResults, isFetching: isSearchingEnc } = useFuncionariosBuscaAtivos({
    search: searchEnc,
    limit: 30,
    enabled: enabledEnc,
  });

  // Busca sob demanda — apontador
  const enabledAp = searchAp.trim().length >= 2;
  const { funcionarios: apResults, isFetching: isSearchingAp } = useFuncionariosBuscaAtivos({
    search: searchAp,
    limit: 30,
    enabled: enabledAp,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome_equipe: "", encarregado_id: "", apontador_id: "", equipe: [] },
  });

  // Rehidratação por id (fallback defensivo se responsável não estiver em existingMembers)
  const encIdCurrent = form.watch("encarregado_id");
  const apIdCurrent = form.watch("apontador_id");
  const idsFaltantes = useMemo(() => {
    const faltantes: string[] = [];
    if (encIdCurrent && !nameMap.has(encIdCurrent)) faltantes.push(encIdCurrent);
    if (apIdCurrent && !nameMap.has(apIdCurrent) && !faltantes.includes(apIdCurrent))
      faltantes.push(apIdCurrent);
    return faltantes;
  }, [encIdCurrent, apIdCurrent, nameMap]);
  const { funcionarios: idsResgatados } = useFuncionariosBuscaAtivos({
    ids: idsFaltantes,
    enabled: idsFaltantes.length > 0,
    limit: 10,
  });

  // Reset ao abrir
  useEffect(() => {
    if (equipe) {
      form.reset({
        nome_equipe: equipe.nome_equipe,
        encarregado_id: equipe.encarregado_id,
        apontador_id: equipe.apontador_id,
        equipe: equipe.equipe || [],
      });
      setSelectedMembros(equipe.equipe || []);
      // Membros manuais = todos os existentes menos os responsáveis
      const manuais = new Set<string>((equipe.equipe || []).filter(
        (id) => id !== equipe.encarregado_id && id !== equipe.apontador_id
      ));
      membrosManuaisRef.current = manuais;
    } else {
      form.reset({ nome_equipe: "", encarregado_id: "", apontador_id: "", equipe: [] });
      setSelectedMembros([]);
      membrosManuaisRef.current = new Set();
    }
    setSearchTerm("");
    setSearchEnc("");
    setSearchAp("");
    setEncOpen(false);
    setApOpen(false);
    setNameMap(new Map());
  }, [equipe, form, isOpen]);

  // Popular nameMap: encarregados + apontadores (props legadas) + existentes + resultados de busca
  useEffect(() => {
    setNameMap((prev) => {
      const next = new Map(prev);
      encarregados.forEach((e) =>
        next.set(e.id, {
          nome_completo: e.nome_completo,
          equipe_id: e.equipe_id ?? null,
          funcao_nome: e?.bd_funcoes?.nome_funcao ?? null,
        })
      );
      apontadores.forEach((a) =>
        next.set(a.id, {
          nome_completo: a.nome_completo,
          equipe_id: a.equipe_id ?? null,
          funcao_nome: a?.bd_funcoes?.nome_funcao ?? null,
        })
      );
      existingMembers.forEach((m) =>
        next.set(m.id, {
          nome_completo: m.nome_completo,
          equipe_id: m.equipe_id ?? null,
          funcao_nome: m.funcao_nome ?? null,
        })
      );
      const merge = (list: any[]) =>
        list.forEach((f: any) =>
          next.set(f.id, {
            nome_completo: f.nome_completo,
            equipe_id: f.equipe_id ?? next.get(f.id)?.equipe_id ?? null,
            funcao_nome: getFuncNome(f) || next.get(f.id)?.funcao_nome || null,
          })
        );
      merge(searchResults);
      merge(encResults);
      merge(apResults);
      merge(idsResgatados);

      return next;
    });
  }, [encarregados, apontadores, existingMembers, searchResults, encResults, apResults, idsResgatados]);

  const bloquearSeOutraEquipe = (funcEquipeId?: string | null): boolean => {
    if (funcEquipeId && (!equipe || funcEquipeId !== equipe.id)) {
      toast(TOAST_OUTRA_EQUIPE);
      return true;
    }
    return false;
  };

  // A RPC get_funcionarios_ativos_global não retorna equipe_id. Quando não sabemos,
  // buscamos pontualmente para preservar o bloqueio de transferência entre equipes.
  const resolverEquipeIdDoFuncionario = async (
    id: string,
    knownEquipeId: string | null | undefined
  ): Promise<string | null> => {
    if (knownEquipeId !== undefined && knownEquipeId !== null) return knownEquipeId;
    const cached = nameMap.get(id)?.equipe_id;
    if (cached !== undefined && cached !== null) return cached;
    try {
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("equipe_id")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        console.warn("[EquipeFormModal] resolverEquipeIdDoFuncionario:", error.message);
        return null;
      }
      const eqId = (data?.equipe_id as string | null) ?? null;
      if (eqId) {
        setNameMap((prev) => {
          const next = new Map(prev);
          const cur = next.get(id);
          next.set(id, {
            nome_completo: cur?.nome_completo ?? "",
            equipe_id: eqId,
            funcao_nome: cur?.funcao_nome ?? null,
          });
          return next;
        });
      }
      return eqId;
    } catch (e) {
      console.warn("[EquipeFormModal] resolverEquipeIdDoFuncionario falhou:", e);
      return null;
    }
  };


  const handleEncarregadoChange = async (value: string, funcEquipeId?: string | null) => {
    if (value) {
      const eqId = await resolverEquipeIdDoFuncionario(value, funcEquipeId);
      if (bloquearSeOutraEquipe(eqId)) return;
    }
    const previous = form.getValues("encarregado_id");
    const apAtual = form.getValues("apontador_id");
    form.setValue("encarregado_id", value);

    let novos = [...selectedMembros];
    // Remover anterior somente se não for o outro responsável e não for membro manual
    if (previous && previous !== value) {
      const manterAnterior = previous === apAtual || membrosManuaisRef.current.has(previous);
      if (!manterAnterior) novos = novos.filter((id) => id !== previous);
    }
    if (value && !novos.includes(value)) novos = [...novos, value];
    setSelectedMembros(novos);
    form.setValue("equipe", novos);

    if (!equipe && value) {
      const info = nameMap.get(value);
      if (info?.nome_completo) form.setValue("nome_equipe", `Equipe ${info.nome_completo}`);
    }
    setEncOpen(false);
    setSearchEnc("");
  };

  const handleApontadorChange = async (value: string, funcEquipeId?: string | null) => {
    if (value) {
      const eqId = await resolverEquipeIdDoFuncionario(value, funcEquipeId);
      if (bloquearSeOutraEquipe(eqId)) return;
    }
    const previous = form.getValues("apontador_id");
    const encAtual = form.getValues("encarregado_id");
    form.setValue("apontador_id", value);

    let novos = [...selectedMembros];
    if (previous && previous !== value) {
      const manterAnterior = previous === encAtual || membrosManuaisRef.current.has(previous);
      if (!manterAnterior) novos = novos.filter((id) => id !== previous);
    }
    if (value && !novos.includes(value)) novos = [...novos, value];
    setSelectedMembros(novos);
    form.setValue("equipe", novos);
    setApOpen(false);
    setSearchAp("");
  };

  const addMembro = async (funcId: string, funcEquipeId: string | null | undefined) => {
    if (selectedMembros.includes(funcId)) {
      toast({
        title: "Funcionário já adicionado",
        description: "Este funcionário já faz parte da equipe.",
        variant: "destructive",
      });
      return;
    }
    const eqId = await resolverEquipeIdDoFuncionario(funcId, funcEquipeId);
    if (bloquearSeOutraEquipe(eqId)) return;

    membrosManuaisRef.current.add(funcId);
    const novos = [...selectedMembros, funcId];
    setSelectedMembros(novos);
    form.setValue("equipe", novos);
  };

  const handleRemoveMembro = (id: string) => {
    const encId = form.getValues("encarregado_id");
    const apId = form.getValues("apontador_id");
    if (id === encId || id === apId) {
      toast({
        title: "Não é possível remover",
        description: "Para remover este funcionário, selecione outro responsável antes.",
        variant: "destructive",
      });
      return;
    }
    membrosManuaisRef.current.delete(id);
    const novos = selectedMembros.filter((m) => m !== id);
    setSelectedMembros(novos);
    form.setValue("equipe", novos);
  };

  const getMemberRole = (id: string) => {
    const enc = form.getValues("encarregado_id");
    const ap = form.getValues("apontador_id");
    if (id === enc) return "encarregado";
    if (id === ap) return "apontador";
    return "membro";
  };

  const getMemberIcon = (role: string) => {
    switch (role) {
      case "encarregado": return <UserCog className="h-3 w-3" />;
      case "apontador": return <UserCheck className="h-3 w-3" />;
      default: return <Users className="h-3 w-3" />;
    }
  };

  const getMemberBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case "encarregado": return "default";
      case "apontador": return "secondary";
      default: return "outline";
    }
  };

  const visibleSearchResults = useMemo(() => {
    if (!enabledSearch) return [];
    const enc = form.getValues("encarregado_id");
    const ap = form.getValues("apontador_id");
    return searchResults.filter(
      (f: any) => !selectedMembros.includes(f.id) && f.id !== enc && f.id !== ap
    );
  }, [enabledSearch, searchResults, selectedMembros, form]);

  const visibleEncResults = useMemo(() => {
    if (!enabledEnc) return [];
    return encResults.filter((f: any) => norm(getFuncNome(f)).includes("encarregado"));
  }, [enabledEnc, encResults]);

  const visibleApResults = useMemo(() => {
    if (!enabledAp) return [];
    return apResults.filter((f: any) => norm(getFuncNome(f)).includes("apontador"));
  }, [enabledAp, apResults]);


  const encInfo = encIdCurrent ? nameMap.get(encIdCurrent) : undefined;
  const apInfo = apIdCurrent ? nameMap.get(apIdCurrent) : undefined;

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const teamMembers = Array.from(
        new Set([...values.equipe, values.encarregado_id, values.apontador_id].filter(Boolean))
      );
      const formData: EquipeFormData = {
        nome_equipe: values.nome_equipe,
        encarregado_id: values.encarregado_id,
        apontador_id: values.apontador_id,
        equipe: teamMembers,
      };

      if (equipe) {
        await updateEquipe(equipe.id, formData);
        toast({ title: "Equipe atualizada", description: "A equipe foi atualizada com sucesso." });
      } else {
        await createEquipe(formData);
        toast({ title: "Equipe cadastrada", description: "A equipe foi cadastrada com sucesso." });
      }

      queryClient.invalidateQueries({ queryKey: ["equipes"] });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      queryClient.invalidateQueries({ queryKey: ["equipe-members"] });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar equipe:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderResponsavelPicker = (params: {
    id: "encarregado" | "apontador";
    value: string;
    info?: { nome_completo: string; funcao_nome?: string | null };
    open: boolean;
    setOpen: (v: boolean) => void;
    search: string;
    setSearch: (v: string) => void;
    enabled: boolean;
    isSearching: boolean;
    results: any[];
    onSelect: (id: string, equipeId: string | null | undefined) => void;
    placeholder: string;
    emptyLabel: string;
  }) => {
    const {
      value, info, open, setOpen, search, setSearch,
      enabled, isSearching, results, onSelect, placeholder, emptyLabel,
    } = params;
    return (
      <div className="space-y-2">
        {value && !open ? (
          <div className="flex items-center justify-between border rounded-md p-2 gap-2">
            <div className="flex flex-col text-sm min-w-0">
              <span className="font-medium truncate">
                {info?.nome_completo || "Funcionário selecionado"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {info?.funcao_nome || "—"}
              </span>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              Trocar
            </Button>
          </div>
        ) : (
          <>
            <Input
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus={open}
            />
            {enabled && (
              <div className="border rounded-md">
                {isSearching ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">{emptyLabel}</div>
                ) : (
                  <ScrollArea className="max-h-48">
                    <div className="divide-y">
                      {results.map((f: any) => {
                        const outraEquipe =
                          !!f.equipe_id && (!equipe || f.equipe_id !== equipe.id);
                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between p-2 gap-2"
                          >
                            <div className="flex flex-col text-sm min-w-0">
                              <span className="font-medium truncate">{f.nome_completo}</span>
                              <span className="text-xs text-muted-foreground truncate">
                               {getFuncNome(f) || "Sem função"}

                                {outraEquipe && (
                                  <span className="ml-2 text-amber-600 font-medium">
                                    · em outra equipe
                                  </span>
                                )}
                              </span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={outraEquipe ? "outline" : "default"}
                              onClick={() => onSelect(f.id, f.equipe_id)}
                            >
                              <Check className="h-4 w-4 mr-1" /> Selecionar
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                }}
              >
                Cancelar troca
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[760px] max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{equipe ? "Editar Equipe" : "Cadastrar Nova Equipe"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nome_equipe"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Nome da Equipe *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da equipe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="encarregado_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" /> Encarregado *
                    </FormLabel>
                    <FormControl>
                      {renderResponsavelPicker({
                        id: "encarregado",
                        value: field.value,
                        info: encInfo,
                        open: encOpen,
                        setOpen: setEncOpen,
                        search: searchEnc,
                        setSearch: setSearchEnc,
                        enabled: enabledEnc,
                        isSearching: isSearchingEnc,
                        results: visibleEncResults,
                        onSelect: (id, eqId) => handleEncarregadoChange(id, eqId),
                        placeholder: "Buscar encarregado (mín. 2 caracteres)...",
                        emptyLabel: "Nenhum encarregado encontrado.",
                      })}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apontador_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" /> Apontador *
                    </FormLabel>
                    <FormControl>
                      {renderResponsavelPicker({
                        id: "apontador",
                        value: field.value,
                        info: apInfo,
                        open: apOpen,
                        setOpen: setApOpen,
                        search: searchAp,
                        setSearch: setSearchAp,
                        enabled: enabledAp,
                        isSearching: isSearchingAp,
                        results: visibleApResults,
                        onSelect: (id, eqId) => handleApontadorChange(id, eqId),
                        placeholder: "Buscar apontador (mín. 2 caracteres)...",
                        emptyLabel: "Nenhum apontador encontrado.",
                      })}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Busca sob demanda */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" /> Adicionar membro
              </label>
              <Input
                placeholder="Digite ao menos 2 caracteres (nome, CPF ou matrícula)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {enabledSearch && (
                <div className="border rounded-md">
                  {isSearching ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                    </div>
                  ) : visibleSearchResults.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      Nenhum funcionário encontrado.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-48">
                      <div className="divide-y">
                        {visibleSearchResults.map((f: any) => {
                          const outraEquipe = !!f.equipe_id && (!equipe || f.equipe_id !== equipe.id);
                          return (
                            <div
                              key={f.id}
                              className="flex items-center justify-between p-2 gap-2"
                            >
                              <div className="flex flex-col text-sm">
                                <span className="font-medium">{f.nome_completo}</span>
                                <span className="text-xs text-muted-foreground">
                                  {getFuncNome(f) || "Sem função"}
                                  {outraEquipe && (
                                    <span className="ml-2 text-amber-600 font-medium">
                                      · em outra equipe
                                    </span>
                                  )}
                                </span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={outraEquipe ? "outline" : "default"}
                                onClick={() => addMembro(f.id, f.equipe_id)}
                              >
                                <Plus className="h-4 w-4 mr-1" /> Adicionar
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Membros selecionados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> Membros da equipe ({selectedMembros.length})
                </label>
              </div>
              <div className="border rounded-md min-h-[80px] max-h-[320px] p-3">
                {isLoadingMembers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando membros...
                  </div>
                ) : selectedMembros.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Nenhum membro. Adicione o encarregado, apontador ou use a busca acima.
                  </div>
                ) : (
                  <ScrollArea className="max-h-[260px]">
                    <div className="flex flex-wrap gap-2 pr-2">
                      {selectedMembros.map((id) => {
                        const role = getMemberRole(id);
                        const info = nameMap.get(id);
                        const isLider = role === "encarregado" || role === "apontador";
                        return (
                          <Badge
                            key={id}
                            variant={getMemberBadgeVariant(role)}
                            className="py-1.5 px-3 text-sm flex items-center gap-2"
                            title={info?.funcao_nome || undefined}
                          >
                            {getMemberIcon(role)}
                            <span>
                              {info?.nome_completo || "Funcionário"}
                              {isLider && (
                                <span className="ml-1 text-xs opacity-75">({role})</span>
                              )}
                            </span>
                            {!isLider && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMembro(id)}
                                className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                                aria-label="Remover"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : equipe ? "Atualizar" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EquipeFormModal;
