
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createCentroCusto, updateCentroCusto, checkCentroCustoExists } from "@/services/centroCustoService";
import { useToast } from "@/hooks/use-toast";
import { CentroCusto, CentroCustoFormData } from "@/types/centroCusto";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";

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
  aprovador_diarias_id: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

const CentroCustoFormModal: React.FC<CentroCustoFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  centroCusto 
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Query para buscar funcionários com função "Gerente Regional" como aprovadores
  const { data: aprovadores = [] } = useQuery({
    queryKey: ['gerentes-regionais-aprovadores'],
    queryFn: async () => {
      // Primeiro buscar o ID da função "Gerente Regional"
      const { data: funcaoGerente } = await supabase
        .from('bd_funcoes')
        .select('id')
        .eq('nome_funcao', 'Gerente Regional')
        .single();

      if (!funcaoGerente?.id) {
        console.warn('Função "Gerente Regional" não encontrada');
        return [];
      }

      // Buscar funcionários com essa função
      const { data: funcionarios } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email')
        .eq('funcao_id', funcaoGerente.id)
        .eq('status', 'Ativo')
        .order('nome_completo');

      return funcionarios || [];
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
      aprovador_diarias_id: ""
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
        aprovador_diarias_id: centroCusto.aprovador_diarias_id || ""
      });
    } else {
      form.reset({
        codigo_centro_custo: "",
        nome_centro_custo: "",
        cnpj_vinculado: "",
        telefone: "",
        situacao: "Ativo",
        aprovador_diarias_id: ""
      });
    }
  }, [centroCusto, form, isOpen]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      
      // Verificar se o centro de custo já existe
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

      const formData: CentroCustoFormData = {
        codigo_centro_custo: values.codigo_centro_custo,
        nome_centro_custo: values.nome_centro_custo,
        cnpj_vinculado: values.cnpj_vinculado || undefined,
        telefone: values.telefone || undefined,
        situacao: values.situacao,
        aprovador_diarias_id: values.aprovador_diarias_id || undefined
      };

      if (centroCusto) {
        // Edição
        await updateCentroCusto(centroCusto.id, formData);
        toast({
          title: "Centro de custo atualizado",
          description: "O centro de custo foi atualizado com sucesso."
        });
      } else {
        // Criação
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
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
