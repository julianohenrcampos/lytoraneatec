import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getEmpresas } from "@/services/empresaService";
import { createFrota, updateFrota, checkCodigoExists, Frota } from "@/services/frotaService";

const formSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório").max(10),
  descricao: z.string().optional().nullable(),
  tipo_propriedade_padrao: z.string().min(1, "Tipo é obrigatório"),
  empresa_id: z.string().optional().nullable(),
  ativo: z.boolean(),
});

interface FrotaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  frota?: Frota;
}

const FrotaFormModal: React.FC<FrotaFormModalProps> = ({ isOpen, onClose, onSuccess, frota }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-dropdown'],
    queryFn: () => getEmpresas({ situacao: 'Ativa' }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: "",
      descricao: "",
      tipo_propriedade_padrao: "PROPRIO",
      empresa_id: "",
      ativo: true,
    },
  });

  useEffect(() => {
    if (frota) {
      form.reset({
        codigo: frota.codigo,
        descricao: frota.descricao || "",
        tipo_propriedade_padrao: frota.tipo_propriedade_padrao || "PROPRIO",
        empresa_id: frota.empresa_id || "",
        ativo: frota.ativo ?? true,
      });
    } else {
      form.reset({
        codigo: "",
        descricao: "",
        tipo_propriedade_padrao: "PROPRIO",
        empresa_id: "",
        ativo: true,
      });
    }
    setIsSubmitting(false);
  }, [frota, isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      const codigoUpper = values.codigo.toUpperCase();

      const exists = await checkCodigoExists(codigoUpper, frota?.id);
      if (exists) {
        form.setError("codigo", { message: "Este código já está em uso" });
        return;
      }

      const data = {
        codigo: codigoUpper,
        descricao: values.descricao || null,
        tipo_propriedade_padrao: values.tipo_propriedade_padrao,
        empresa_id: values.empresa_id || null,
        ativo: values.ativo,
      };

      if (frota) {
        await updateFrota(frota.id, data);
        toast({ title: "Frota atualizada", description: `Frota "${codigoUpper}" atualizada com sucesso.` });
      } else {
        await createFrota(data);
        toast({ title: "Frota criada", description: `Frota "${codigoUpper}" criada com sucesso.` });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar frota:", error);
      toast({ title: "Erro", description: "Erro ao salvar a frota.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{frota ? "Editar Frota" : "Nova Frota"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: LYC, LOC" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Descrição da frota" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tipo_propriedade_padrao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PROPRIO">Próprio</SelectItem>
                      <SelectItem value="LOCADO">Locado</SelectItem>
                      <SelectItem value="TERCEIRO">Terceiro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="empresa_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa Vinculada</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "_none"}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma</SelectItem>
                      {empresas.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.nome_empresa}</SelectItem>
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
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="mb-0">Ativo</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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

export default FrotaFormModal;
