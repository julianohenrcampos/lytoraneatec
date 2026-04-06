
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
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let page = 0;
      while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data } = await supabase.rpc('get_funcionarios_para_diarias').range(from, to);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }
      return allData
        .filter((f: any) => f.funcao_nome?.toLowerCase() === 'gerente regional')
        .map((f: any) => ({
          id: f.id,
          nome_completo: f.nome_completo,
          email: null
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

  const { data: admSedeCandidates = [] } = useQuery({
    queryKey: ['adm-sede-candidates'],
    queryFn: async () => {
      const { data } = await (supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, bd_funcoes(nome_funcao)")
        .eq("status", "Ativo") as any);
      return (data || []).filter((f: any) => {
        const funcao = (f.bd_funcoes?.nome_funcao || '').toLowerCase();
        return funcao.includes('administrativo') || funcao.includes('adm');
      }).map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        funcao: f.bd_funcoes?.nome_funcao || 'Sem função'
      }));
    },
    enabled: isOpen
  });
  
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
    form.setValue("geocoding_status", "success");
    form.clearErrors("endereco_completo");
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      
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

      // Preserve original FK values if form value is empty but original has data
      const resolveFK = (formVal: string | undefined, originalVal: string | null | undefined) => {
        if (formVal && formVal !== '__none__') return formVal;
        if (!formVal && centroCusto && originalVal) return originalVal;
        return undefined;
      };

      const formData: CentroCustoFormData = {
        codigo_centro_custo: values.codigo_centro_custo,
        nome_centro_custo: values.nome_centro_custo,
        cnpj_vinculado: values.cnpj_vinculado || undefined,
        telefone: values.telefone || undefined,
        situacao: values.situacao,
        aprovador_diarias_id: resolveFK(values.aprovador_diarias_id, centroCusto?.aprovador_diarias_id),
        adm_sede_funcionario_id: resolveFK(values.adm_sede_funcionario_id, centroCusto?.adm_sede_funcionario_id),
        diretoria_id: resolveFK(values.diretoria_id, centroCusto?.diretoria_id),
        departamento_id: resolveFK(values.departamento_id, centroCusto?.departamento_id),
        endereco_completo: values.endereco_completo || undefined,
        endereco_rua: values.endereco_rua || undefined,
        endereco_numero: values.endereco_numero || undefined,
        endereco_bairro: values.endereco_bairro || undefined,
        endereco_cidade: values.endereco_cidade || undefined,
        endereco_estado: values.endereco_estado || undefined,
        endereco_cep: values.endereco_cep || undefined,
        latitude: values.latitude,
        longitude: values.longitude,
        geocoding_status: values.geocoding_status || "pending",
      };

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
      console.error("Erro ao salvar centro de custo:", error);
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {centroCusto ? "Editar Centro de Custo" : "Cadastrar Novo Centro de Custo"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      isValidated={isAddressValidated}
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
                      options={admSedeCandidates.map((adm: any) => ({
                        value: adm.id,
                        label: adm.nome_completo,
                      }))}
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Selecione um ADM SEDE..."
                      searchPlaceholder="Buscar funcionário..."
                      emptyText="Nenhum funcionário encontrado"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas funcionários com função Administrativo/ADM são listados.
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
            
            <DialogFooter className="pt-4">
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
