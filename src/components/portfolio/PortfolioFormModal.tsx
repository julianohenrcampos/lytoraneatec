import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { getEmpresasFornecedorasDropdown, PortfolioEmpresa } from "@/services/portfolioEmpresaService";
import { getSubcategoriasDropdown, UNIDADES_CAPACIDADE, findOrCreateVariacao, buildVariacaoLabel } from "@/services/catalogoVariacoesService";

const schema = z.object({
  empresa_id: z.string().min(1, "Empresa é obrigatória"),
  subcategoria_id: z.string().min(1, "Subcategoria é obrigatória"),
  capacidade_valor: z.coerce.number().min(0.01, "Capacidade é obrigatória"),
  capacidade_unidade: z.string().min(1, "Unidade é obrigatória"),
  quantidade_estimada: z.coerce.number().optional(),
  fornece_com_operador: z.boolean().default(false),
  fornece_sem_operador: z.boolean().default(false),
  valor_ref_com_operador: z.coerce.number().optional(),
  valor_ref_sem_operador: z.coerce.number().optional(),
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
  const { data: subcategorias = [] } = useQuery({ queryKey: ["subcategorias-dd"], queryFn: getSubcategoriasDropdown });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      empresa_id: "", subcategoria_id: "", capacidade_valor: undefined,
      capacidade_unidade: "", quantidade_estimada: undefined,
      fornece_com_operador: false, fornece_sem_operador: false,
      valor_ref_com_operador: undefined, valor_ref_sem_operador: undefined,
      observacoes: "", ativo: true,
    },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        empresa_id: editingItem.empresa_id,
        subcategoria_id: (editingItem as any).variacao_subcategoria_id || "",
        capacidade_valor: (editingItem as any).variacao_capacidade_valor ?? undefined,
        capacidade_unidade: (editingItem as any).variacao_capacidade_unidade || "",
        quantidade_estimada: editingItem.quantidade_estimada ?? undefined,
        fornece_com_operador: editingItem.fornece_com_operador ?? false,
        fornece_sem_operador: editingItem.fornece_sem_operador ?? false,
        valor_ref_com_operador: editingItem.valor_ref_com_operador ?? undefined,
        valor_ref_sem_operador: editingItem.valor_ref_sem_operador ?? undefined,
        observacoes: editingItem.observacoes || "",
        ativo: editingItem.ativo ?? true,
      });
    } else {
      form.reset({
        empresa_id: "", subcategoria_id: "", capacidade_valor: undefined,
        capacidade_unidade: "", quantidade_estimada: undefined,
        fornece_com_operador: false, fornece_sem_operador: false,
        valor_ref_com_operador: undefined, valor_ref_sem_operador: undefined,
        observacoes: "", ativo: true,
      });
    }
  }, [editingItem, isOpen]);

  const empresaOptions = useMemo(() => empresas.map((e) => ({ value: e.id, label: e.nome_empresa })), [empresas]);
  const subcategoriaOptions = useMemo(() => subcategorias.map((s: any) => ({ value: s.id, label: s.nome_subcategoria })), [subcategorias]);

  const selectedEmpresa = empresas.find((e) => e.id === form.watch("empresa_id"));
  const watchSubcategoria = form.watch("subcategoria_id");
  const watchCapValor = form.watch("capacidade_valor");
  const watchCapUnidade = form.watch("capacidade_unidade");

  const subcategoriaNome = subcategorias.find((s: any) => s.id === watchSubcategoria)?.nome_subcategoria;
  const previewLabel = buildVariacaoLabel(subcategoriaNome, watchCapValor, watchCapUnidade);

  const handleSubmit = async (values: FormValues) => {
    // findOrCreate variacao
    const variacaoId = await findOrCreateVariacao(
      values.subcategoria_id,
      values.capacidade_valor || null,
      values.capacidade_unidade || null
    );

    await onSubmit({
      ...(editingItem ? { id: editingItem.id } : {}),
      empresa_id: values.empresa_id,
      catalogo_variacao_id: variacaoId,
      tipo_equipamento_id: null,
      catalogo_equipamento_id: null,
      quantidade_estimada: values.quantidade_estimada || null,
      fornece_com_operador: values.fornece_com_operador,
      fornece_sem_operador: values.fornece_sem_operador,
      valor_ref_com_operador: values.valor_ref_com_operador || null,
      valor_ref_sem_operador: values.valor_ref_sem_operador || null,
      observacoes: values.observacoes || null,
      ativo: values.ativo,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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

            <FormField control={form.control} name="subcategoria_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategoria (Tipo de Equipamento) *</FormLabel>
                <FormControl>
                  <Combobox options={subcategoriaOptions} value={field.value} onChange={field.onChange} placeholder="Selecione a subcategoria" searchPlaceholder="Buscar..." emptyText="Nenhuma encontrada" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="capacidade_valor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade *</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0} {...field} value={field.value || ""} placeholder="Ex: 14" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="capacidade_unidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidade *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {UNIDADES_CAPACIDADE.map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {watchSubcategoria && watchCapValor && (
              <div className="p-3 rounded-md bg-muted border text-sm">
                <span className="text-muted-foreground">Preview: </span>
                <strong>{previewLabel}</strong>
              </div>
            )}

            <FormField control={form.control} name="quantidade_estimada" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade Estimada</FormLabel>
                <FormControl><Input type="number" min={0} {...field} value={field.value || ""} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="valor_ref_com_operador" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Ref. c/ Operador (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0} {...field} value={field.value || ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="valor_ref_sem_operador" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Ref. s/ Operador (R$)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0} {...field} value={field.value || ""} /></FormControl>
                </FormItem>
              )} />
            </div>

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
