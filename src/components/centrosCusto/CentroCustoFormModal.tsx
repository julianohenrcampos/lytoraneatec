
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createCentroCusto, updateCentroCusto, checkCentroCustoExists } from "@/services/centroCustoService";
import { useToast } from "@/hooks/use-toast";
import { CentroCusto, CentroCustoFormData } from "@/types/centroCusto";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Info } from "lucide-react";
import AddressAutocomplete, { AddressResult } from "./AddressAutocomplete";
import { validateAddressForSave } from "@/lib/geocoding/validateForSave";

interface CentroCustoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  centroCusto?: CentroCusto;
}

const formSchema = z.object({
  codigo_centro_custo: z.string().min(1, { message: "Código é obrigatório" }),
  nome_centro_custo: z.string().min(1, { message: "Nome do centro de custo é obrigatório" }),
  cnpj_vinculado: z.string().optional(),
  telefone: z.string().optional(),
  situacao: z.enum(["Ativo", "Inativo"]),
  aprovador_diarias_id: z.string().optional(),
  adm_sede_funcionario_id: z.string().min(1, { message: "ADM SEDE é obrigatório" }),
  adm_obra_funcionario_id: z.string().optional(),
  diretoria_id: z.string().optional(),
  departamento_id: z.string().min(1, { message: "Departamento é obrigatório" }),
  // Address fields (hidden from user)
  endereco_completo: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  endereco_cep: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  geocoding_status: z.string().optional(),
}).refine(
  (data) => {
    // If endereco_completo is filled, lat/lng must be present
    if (data.endereco_completo && data.endereco_completo.trim().length > 0) {
      return data.latitude !== undefined && data.longitude !== undefined;
    }
    return true;
  },
  {
    message: "Selecione um endereço da lista para validar as coordenadas",
    path: ["endereco_completo"],
  }
);

type FormValues = z.infer<typeof formSchema>;

const CentroCustoFormModal: React.FC<CentroCustoFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  centroCusto 
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: aprovadores = [] } = useQuery({
    queryKey: ['gerentes-regionais-aprovadores'],
    queryFn: async () => {
      const { data: funcao } = await supabase
        .from('bd_funcoes')
        .select('id')
        .ilike('nome_funcao', 'gerente regional')
        .maybeSingle();
      if (!funcao?.id) return [];
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo')
        .eq('funcao_id', funcao.id)
        .in('status', ['Ativo', 'Ativo sem Registro'])
        .order('nome_completo');
      return (data || []).map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        email: null,
      }));
    },
    enabled: isOpen
  });

  const { data: diretorias = [] } = useQuery({
    queryKey: ['diretorias-ativas'],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_diretorias")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: isOpen
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos-dropdown'],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_departamentos")
        .select("id, nome_departamento, empresa_id, empresa:bd_empresas(nome_empresa)")
        .order("nome_departamento");
      return (data || []) as any[];
    },
    enabled: isOpen
  });

  const { data: admSedeData = { list: [], fallback: false } } = useQuery({
    queryKey: ['adm-sede-candidates-v2'],
    enabled: isOpen,
    queryFn: async () => {
      try {
        const { buscarFuncionariosPorRole, buscarFuncionariosFallbackAdministrativo } =
          await import("@/services/centrosCusto/fetchResponsaveisPorRole");
        const list = await buscarFuncionariosPorRole("AdmSede");
        console.log("[CENTRO_CUSTO][ADM_SEDE_CANDIDATES]", list);
        if (list.length > 0) return { list, fallback: false };
        // TEMP FALLBACK enquanto não há usuários com role AdmSede
        const fb = await buscarFuncionariosFallbackAdministrativo();
        console.log("[CENTRO_CUSTO][ADM_SEDE_FALLBACK_CANDIDATES]", fb);
        return { list: fb, fallback: true };
      } catch (error) {
        console.error("[CENTRO_CUSTO][ADM_SEDE_CANDIDATES_ERROR]", error);
        return { list: [], fallback: false };
      }
    },
  });
  const admSedeCandidates = admSedeData.list;
  const admSedeFallback = admSedeData.fallback;

  const { data: admObraCandidates = [] } = useQuery({
    queryKey: ['adm-obra-candidates-v2'],
    enabled: isOpen,
    queryFn: async () => {
      try {
        const { buscarFuncionariosPorRole } =
          await import("@/services/centrosCusto/fetchResponsaveisPorRole");
        const list = await buscarFuncionariosPorRole("AdmOBRA");
        console.log("[CENTRO_CUSTO][ADM_OBRA_CANDIDATES]", list);
        return list;
      } catch (error) {
        console.error("[CENTRO_CUSTO][ADM_OBRA_CANDIDATES_ERROR]", error);
        return [];
      }
    },
  });

  // Preservar funcionário atual em edição se não estiver na lista carregada
  const { data: extraSedeCandidate } = useQuery({
    queryKey: ['adm-sede-extra', centroCusto?.adm_sede_funcionario_id, admSedeCandidates.length],
    enabled: isOpen && !!centroCusto?.adm_sede_funcionario_id &&
      !admSedeCandidates.some((c: any) => c.id === centroCusto?.adm_sede_funcionario_id),
    queryFn: async () => {
      const { buscarFuncionarioPorId } = await import("@/services/centrosCusto/fetchResponsaveisPorRole");
      return buscarFuncionarioPorId(centroCusto!.adm_sede_funcionario_id!);
    },
  });

  const { data: extraObraCandidate } = useQuery({
    queryKey: ['adm-obra-extra', centroCusto?.adm_obra_funcionario_id, admObraCandidates.length],
    enabled: isOpen && !!centroCusto?.adm_obra_funcionario_id &&
      !admObraCandidates.some((c: any) => c.id === centroCusto?.adm_obra_funcionario_id),
    queryFn: async () => {
      const { buscarFuncionarioPorId } = await import("@/services/centrosCusto/fetchResponsaveisPorRole");
      return buscarFuncionarioPorId(centroCusto!.adm_obra_funcionario_id!);
    },
  });

  const admSedeOptions = extraSedeCandidate
    ? [extraSedeCandidate, ...admSedeCandidates]
    : admSedeCandidates;
  const admObraOptions = extraObraCandidate
    ? [extraObraCandidate, ...admObraCandidates]
    : admObraCandidates;

  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo_centro_custo: "",
      nome_centro_custo: "",
      cnpj_vinculado: "",
      telefone: "",
      situacao: "Ativo",
      aprovador_diarias_id: "",
      adm_sede_funcionario_id: "",
      adm_obra_funcionario_id: "",
      diretoria_id: "",
      departamento_id: "",
      endereco_completo: "",
      endereco_rua: "",
      endereco_numero: "",
      endereco_bairro: "",
      endereco_cidade: "",
      endereco_estado: "",
      endereco_cep: "",
      latitude: undefined,
      longitude: undefined,
      geocoding_status: "pending",
    }
  });

  useEffect(() => {
    if (centroCusto) {
      form.reset({
        codigo_centro_custo: centroCusto.codigo_centro_custo,
        nome_centro_custo: centroCusto.nome_centro_custo,
        cnpj_vinculado: centroCusto.cnpj_vinculado || "",
        telefone: centroCusto.telefone || "",
        situacao: centroCusto.situacao,
        aprovador_diarias_id: centroCusto.aprovador_diarias_id || "",
        adm_sede_funcionario_id: centroCusto.adm_sede_funcionario_id || "",
        adm_obra_funcionario_id: centroCusto.adm_obra_funcionario_id || "",
        diretoria_id: centroCusto.diretoria_id || "",
        departamento_id: centroCusto.departamento_id || "",
        endereco_completo: centroCusto.endereco_completo || "",
        endereco_rua: centroCusto.endereco_rua || "",
        endereco_numero: centroCusto.endereco_numero || "",
        endereco_bairro: centroCusto.endereco_bairro || "",
        endereco_cidade: centroCusto.endereco_cidade || "",
        endereco_estado: centroCusto.endereco_estado || "",
        endereco_cep: centroCusto.endereco_cep || "",
        latitude: centroCusto.latitude ? Number(centroCusto.latitude) : undefined,
        longitude: centroCusto.longitude ? Number(centroCusto.longitude) : undefined,
        geocoding_status: centroCusto.geocoding_status || "pending",
      });
    } else {
      form.reset({
        codigo_centro_custo: "",
        nome_centro_custo: "",
        cnpj_vinculado: "",
        telefone: "",
        situacao: "Ativo",
        aprovador_diarias_id: "",
        adm_sede_funcionario_id: "",
        adm_obra_funcionario_id: "",
        diretoria_id: "",
        departamento_id: "",
        endereco_completo: "",
        latitude: undefined,
        longitude: undefined,
        geocoding_status: "pending",
      });
    }
  }, [centroCusto, form, isOpen]);

  const handleAddressSelected = (result: AddressResult) => {
    form.setValue("endereco_completo", result.endereco_completo);
    form.setValue("latitude", result.latitude);
    form.setValue("longitude", result.longitude);
    form.setValue("endereco_rua", result.endereco_rua || "");
    form.setValue("endereco_numero", result.endereco_numero || "");
    form.setValue("endereco_bairro", result.endereco_bairro || "");
    form.setValue("endereco_cidade", result.endereco_cidade || "");
    form.setValue("endereco_estado", result.endereco_estado || "");
    form.setValue("endereco_cep", result.endereco_cep || "");
    form.setValue("geocoding_status", result.geocoding_status);
    form.clearErrors("endereco_completo");
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);

      // Validação de geocoding (espelha a trigger do banco)
      const geoCheck = validateAddressForSave({
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
        geocoding_status: values.geocoding_status as any,
        endereco_completo: values.endereco_completo ?? null,
      });
      if (!geoCheck.ok) {
        form.setError("endereco_completo", {
          type: "manual",
          message: geoCheck.message || "Endereço requer ajuste no mapa",
        });
        toast({
          title: "Endereço pendente",
          description: geoCheck.message,
          variant: "destructive",
        });
        return;
      }

      const exists = await checkCentroCustoExists(
        values.codigo_centro_custo, 
        values.nome_centro_custo,
        centroCusto?.id
      );
      
      if (exists) {
        form.setError("codigo_centro_custo", { 
          type: "manual", 
          message: "Este código ou nome de centro de custo já existe" 
        });
        return;
      }

      // FK opcional: vazio/__none__ → undefined (service converte para null).
      // NÃO ressuscitar valor original — caso contrário, limpar/trocar não persiste.
      const resolveOptionalFK = (formVal?: string) =>
        formVal && formVal !== '__none__' ? formVal : undefined;

      // Normaliza geocoding_status legado antes de enviar ao banco.
      // Regra exata aprovada: success → auto, vazio/null/undefined → pending,
      // demais valores são preservados (auto, manual, aproximado, erro, pending).
      const normalizeGeocodingStatusForSave = (status?: string | null) => {
        if (status === "success") return "auto";
        if (!status) return "pending";
        return status;
      };

      console.log("[CENTRO_CUSTO][FORM_VALUES_BEFORE_SUBMIT]", form.getValues());
      console.log("[CENTRO_CUSTO][ADM_SEDE_VALUE_BEFORE_SUBMIT]", form.getValues("adm_sede_funcionario_id"));
      console.log("[CENTRO_CUSTO][ADM_OBRA_VALUE_BEFORE_SUBMIT]", form.getValues("adm_obra_funcionario_id"));
      console.log("[CENTRO_CUSTO][DEPARTAMENTO_VALUE_BEFORE_SUBMIT]", form.getValues("departamento_id"));
      console.log("[CENTRO_CUSTO][SUBMIT_FORM_DATA]", values);

      const formData: CentroCustoFormData = {
        codigo_centro_custo: values.codigo_centro_custo,
        nome_centro_custo: values.nome_centro_custo,
        cnpj_vinculado: values.cnpj_vinculado || undefined,
        telefone: values.telefone || undefined,
        situacao: values.situacao,
        aprovador_diarias_id: resolveOptionalFK(values.aprovador_diarias_id),
        adm_sede_funcionario_id: resolveOptionalFK(values.adm_sede_funcionario_id),
        adm_obra_funcionario_id: resolveOptionalFK(values.adm_obra_funcionario_id),
        diretoria_id: resolveOptionalFK(values.diretoria_id),
        departamento_id: resolveOptionalFK(values.departamento_id),
        endereco_completo: values.endereco_completo || undefined,
        endereco_rua: values.endereco_rua || undefined,
        endereco_numero: values.endereco_numero || undefined,
        endereco_bairro: values.endereco_bairro || undefined,
        endereco_cidade: values.endereco_cidade || undefined,
        endereco_estado: values.endereco_estado || undefined,
        endereco_cep: values.endereco_cep || undefined,
        latitude: values.latitude,
        longitude: values.longitude,
        geocoding_status: normalizeGeocodingStatusForSave(values.geocoding_status),
      };

      console.log("[CENTRO_CUSTO][SUBMIT_PAYLOAD]", formData);
      console.log("[CENTRO_CUSTO][SUBMIT_PAYLOAD_FINAL]", formData);

      if (centroCusto) {
        await updateCentroCusto(centroCusto.id, formData);
        toast({
          title: "Centro de custo atualizado",
          description: "O centro de custo foi atualizado com sucesso."
        });
      } else {
        await createCentroCusto(formData);
        toast({
          title: "Centro de custo cadastrado",
          description: "O centro de custo foi cadastrado com sucesso."
        });
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("[CENTRO_CUSTO][SAVE_ERROR]", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar os dados do centro de custo.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchLat = form.watch("latitude");
  const watchEnderecoCompleto = form.watch("endereco_completo");
  const isAddressValidated = !!watchLat && !!watchEnderecoCompleto;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-3xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>
            {centroCusto ? "Editar Centro de Custo" : "Cadastrar Novo Centro de Custo"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <FormField
              control={form.control}
              name="codigo_centro_custo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código *</FormLabel>
                  <FormControl>
                    <Input placeholder="Código do centro de custo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="nome_centro_custo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Centro de Custo *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do centro de custo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cnpj_vinculado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ Vinculado</FormLabel>
                  <FormControl>
                    <Input placeholder="CNPJ vinculado" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="Telefone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Endereço com autocomplete */}
            <FormField
              control={form.control}
              name="endereco_completo"
              render={() => (
                <FormItem>
                  <FormLabel>Endereço da Obra</FormLabel>
                  <FormControl>
                    <AddressAutocomplete
                      value={watchEnderecoCompleto || ""}
                      initialLatitude={form.watch("latitude") ?? null}
                      initialLongitude={form.watch("longitude") ?? null}
                      initialStatus={(form.watch("geocoding_status") as any) ?? null}
                      onAddressSelected={handleAddressSelected}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="situacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Situação *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma situação" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Campo Aprovador de Diárias */}
            <FormField
              control={form.control}
              name="aprovador_diarias_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Aprovador de Diárias
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um aprovador..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione um Gerente Regional...</SelectItem>
                      {aprovadores.map((aprov: any) => (
                        <SelectItem key={aprov.id} value={aprov.id}>
                          {aprov.nome_completo}{aprov.email ? ` (${aprov.email})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas funcionários cadastrados como "Gerente Regional" podem ser aprovadores de diárias.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo ADM SEDE Responsável */}
            <FormField
              control={form.control}
              name="adm_sede_funcionario_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ADM SEDE Responsável *</FormLabel>
                  <FormControl>
                    <Combobox
                      options={admSedeOptions.map((adm: any) => ({
                        value: adm.id,
                        label: adm.funcao
                          ? `${adm.nome_completo} (${adm.funcao})`
                          : adm.nome_completo,
                      }))}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Selecione um ADM SEDE..."
                      searchPlaceholder="Buscar funcionário..."
                      emptyText="Nenhum ADM SEDE encontrado. Verifique se o usuário possui role AdmSede e está vinculado a um funcionário."
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    {admSedeFallback
                      ? "Lista carregada por função/cargo administrativo porque ainda não há usuários vinculados à role AdmSede."
                      : "Apenas usuários com a role AdmSede são listados."}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo ADM OBRA Responsável */}
            <FormField
              control={form.control}
              name="adm_obra_funcionario_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ADM OBRA Responsável</FormLabel>
                  <FormControl>
                    <Combobox
                      options={admObraOptions.map((adm: any) => ({
                        value: adm.id,
                        label: adm.funcao
                          ? `${adm.nome_completo} (${adm.funcao})`
                          : adm.nome_completo,
                      }))}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Selecione um ADM OBRA..."
                      searchPlaceholder="Buscar funcionário..."
                      emptyText="Nenhum funcionário com role AdmOBRA encontrado"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas usuários com a role <strong>AdmOBRA</strong> são listados. Um mesmo AdmOBRA pode ser responsável por múltiplos centros de custo.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo Diretoria Responsável */}
            <FormField
              control={form.control}
              name="diretoria_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diretoria Responsável</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || "__none__"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma diretoria..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione uma diretoria...</SelectItem>
                      {diretorias.map((dir: any) => (
                        <SelectItem key={dir.id} value={dir.id}>
                          {dir.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo Departamento */}
            <FormField
              control={form.control}
              name="departamento_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um departamento..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departamentos.map((dep: any) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.nome_departamento}{dep.empresa?.nome_empresa ? ` (${dep.empresa.nome_empresa})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-background shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CentroCustoFormModal;
