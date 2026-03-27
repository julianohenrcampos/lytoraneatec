import React, { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { getEmpresasFornecedorasDropdown, PortfolioEmpresa } from "@/services/portfolioEmpresaService";
import { getTiposEquipamentoDropdown } from "@/services/veiculo/dropdownsRelacional";

const schema = z.object({
  empresa_id: z.string().min(1, "Empresa é obrigatória"),
  tipo_equipamento_id: z.string().min(1, "Tipo de equipamento é obrigatório"),
  quantidade_estimada: z.coerce.number().optional(),
  fornece_com_operador: z.boolean().default(false),
  fornece_sem_operador: z.boolean().default(false),
  observacoes: z.string().optional(),
  ativo: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  editingItem: PortfolioEmpresa | null;
}

const PortfolioFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, isSubmitting, editingItem }) => {
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-fornecedoras-dd"], queryFn: getEmpresasFornecedorasDropdown });
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos-equip-dd"], queryFn: getTiposEquipamentoDropdown });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { empresa_id: "", tipo_equipamento_id: "", quantidade_estimada: undefined, fornece_com_operador: false, fornece_sem_operador: false, observacoes: "", ativo: true },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        empresa_id: editingItem.empresa_id,
        tipo_equipamento_id: editingItem.tipo_equipamento_id || "",
        quantidade_estimada: editingItem.quantidade_estimada ?? undefined,
        fornece_com_operador: editingItem.fornece_com_operador ?? false,
        fornece_sem_operador: editingItem.fornece_sem_operador ?? false,
        observacoes: editingItem.observacoes || "",
        ativo: editingItem.ativo ?? true,
      });
    } else {
      form.reset({ empresa_id: "", tipo_equipamento_id: "", quantidade_estimada: undefined, fornece_com_operador: false, fornece_sem_operador: false, observacoes: "", ativo: true });
    }
  }, [editingItem, isOpen]);

  const empresaOptions = useMemo(() => empresas.map((e) => ({ value: e.id, label: e.nome_empresa })), [empresas]);
  const tipoOptions = useMemo(() => tipos.map((t) => ({ value: t.id, label: t.descricao_padronizada })), [tipos]);

  const selectedEmpresa = empresas.find((e) => e.id === form.watch("empresa_id"));

  const handleSubmit = async (values: FormValues) => {
    await onSubmit({
      ...(editingItem ? { id: editingItem.id } : {}),
      ...values,
      quantidade_estimada: values.quantidade_estimada || null,
      observacoes: values.observacoes || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Portfólio" : "Novo Portfólio"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="empresa_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa Fornecedora *</FormLabel>
                <FormControl>
                  <Combobox options={empresaOptions} value={field.value} onChange={field.onChange} placeholder="Selecione a empresa" searchPlaceholder="Buscar..." emptyText="Nenhuma encontrada" />
                </FormControl>
                {selectedEmpresa?.status_homologacao && (
                  <Badge variant="outline" className={selectedEmpresa.status_homologacao === "HOMOLOGADO" ? "bg-green-100 text-green-800" : selectedEmpresa.status_homologacao === "PENDENTE" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                    {selectedEmpresa.status_homologacao}
                  </Badge>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="tipo_equipamento_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Equipamento *</FormLabel>
                <FormControl>
                  <Combobox options={tipoOptions} value={field.value} onChange={field.onChange} placeholder="Selecione o tipo" searchPlaceholder="Buscar..." emptyText="Nenhum encontrado" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantidade_estimada" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade Estimada</FormLabel>
                <FormControl><Input type="number" min={0} {...field} value={field.value || ""} /></FormControl>
              </FormItem>
            )} />

            <div className="flex gap-6">
              <FormField control={form.control} name="fornece_com_operador" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="cursor-pointer">Com Operador</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="fornece_sem_operador" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="cursor-pointer">Sem Operador</FormLabel>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="ativo" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="cursor-pointer">Ativo</FormLabel>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioFormModal;
