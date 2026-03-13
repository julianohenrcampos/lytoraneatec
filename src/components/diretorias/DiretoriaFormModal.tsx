import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createDiretoria, updateDiretoria } from "@/services/diretoriaService";
import { useToast } from "@/hooks/use-toast";
import { Diretoria } from "@/types/diretoria";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  diretoria?: Diretoria;
}

const formSchema = z.object({
  nome: z.string().min(1, "Nome da diretoria é obrigatório"),
  diretor_id: z.string().optional(),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const TIPOS = [
  { value: "operacional", label: "Operacional" },
  { value: "administrativa", label: "Administrativa" },
  { value: "financeira", label: "Financeira" },
  { value: "institucional", label: "Institucional" },
  { value: "executiva", label: "Executiva" },
];

const DiretoriaFormModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, diretoria }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: diretores = [] } = useQuery({
    queryKey: ["funcionarios-diretores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, funcao_id, bd_funcoes!bd_funcionarios_funcao_id_fkey(nome_funcao)")
        .eq("status", "Ativo");
      return (data || []).filter((f: any) => {
        const funcaoNome = f.bd_funcoes?.nome_funcao?.toLowerCase() || "";
        return funcaoNome.includes("diretor");
      }).map((f: any) => ({ id: f.id, nome_completo: f.nome_completo }));
    },
    enabled: isOpen,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: "", diretor_id: "", tipo: "operacional", ativo: true },
  });

  useEffect(() => {
    if (diretoria) {
      form.reset({
        nome: diretoria.nome,
        diretor_id: diretoria.diretor_id || "",
        tipo: diretoria.tipo || "operacional",
        ativo: diretoria.ativo,
      });
    } else {
      form.reset({ nome: "", diretor_id: "", tipo: "operacional", ativo: true });
    }
  }, [diretoria, form, isOpen]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const payload = {
        nome: values.nome,
        diretor_id: values.diretor_id || undefined,
        tipo: values.tipo,
        ativo: values.ativo,
      };

      if (diretoria) {
        await updateDiretoria(diretoria.id, payload);
        toast({ title: "Diretoria atualizada", description: "Diretoria atualizada com sucesso." });
      } else {
        await createDiretoria(payload);
        toast({ title: "Diretoria cadastrada", description: "Diretoria cadastrada com sucesso." });
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar diretoria.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{diretoria ? "Editar Diretoria" : "Cadastrar Nova Diretoria"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Diretoria *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Diretoria de Engenharia" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="diretor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diretor Responsável *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um diretor..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Selecione um Diretor...</SelectItem>
                      {diretores.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.nome_completo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas funcionários com função "Diretor" são listados.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo da Diretoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Situação</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "true")}
                    value={String(field.value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
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

export default DiretoriaFormModal;
