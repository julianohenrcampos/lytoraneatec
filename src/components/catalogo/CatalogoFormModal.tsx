import React, { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { CatalogoEquipamento, getCategoriasDropdown, getSubcategoriasDropdown } from "@/services/catalogoEquipamentoService";
import { getTiposEquipamentoDropdown, getFabricantesRelacionalDropdown, getModelosDropdown } from "@/services/veiculo/dropdownsRelacional";

const schema = z.object({
  tipo_equipamento_id: z.string().min(1, "Tipo é obrigatório"),
  categoria_id: z.string().optional(),
  subcategoria_id: z.string().optional(),
  fabricante_id: z.string().optional(),
  modelo_id: z.string().optional(),
  ano_fabricacao_padrao: z.coerce.number().optional(),
  capacidade: z.string().optional(),
  potencia: z.string().optional(),
  combustivel: z.string().optional(),
  cor_padrao: z.string().optional(),
  motor_padrao: z.string().optional(),
  descricao_padrao: z.string().optional(),
  imagem_url: z.string().optional(),
  ativo: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  editingItem: CatalogoEquipamento | null;
}

const CatalogoFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, isSubmitting, editingItem }) => {
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos-equip-dd"], queryFn: getTiposEquipamentoDropdown });
  const { data: categorias = [] } = useQuery({ queryKey: ["categorias-dd"], queryFn: getCategoriasDropdown });
  const { data: fabricantes = [] } = useQuery({ queryKey: ["fabricantes-dd"], queryFn: getFabricantesRelacionalDropdown });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo_equipamento_id: "", categoria_id: "", subcategoria_id: "", fabricante_id: "", modelo_id: "",
      ano_fabricacao_padrao: undefined, capacidade: "", potencia: "", combustivel: "", cor_padrao: "",
      motor_padrao: "", descricao_padrao: "", imagem_url: "", ativo: true,
    },
  });

  const selectedCategoriaId = form.watch("categoria_id");
  const selectedFabricanteId = form.watch("fabricante_id");

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias-dd", selectedCategoriaId],
    queryFn: () => getSubcategoriasDropdown(selectedCategoriaId),
    enabled: !!selectedCategoriaId,
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos-dd", selectedFabricanteId],
    queryFn: () => getModelosDropdown(selectedFabricanteId),
    enabled: !!selectedFabricanteId,
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        tipo_equipamento_id: editingItem.tipo_equipamento_id || "",
        categoria_id: editingItem.categoria_id || "",
        subcategoria_id: editingItem.subcategoria_id || "",
        fabricante_id: editingItem.fabricante_id || "",
        modelo_id: editingItem.modelo_id || "",
        ano_fabricacao_padrao: editingItem.ano_fabricacao_padrao ?? undefined,
        capacidade: editingItem.capacidade || "",
        potencia: editingItem.potencia || "",
        combustivel: editingItem.combustivel || "",
        cor_padrao: editingItem.cor_padrao || "",
        motor_padrao: editingItem.motor_padrao || "",
        descricao_padrao: editingItem.descricao_padrao || "",
        imagem_url: (editingItem as any).imagem_url || "",
        ativo: editingItem.ativo ?? true,
      });
    } else {
      form.reset({
        tipo_equipamento_id: "", categoria_id: "", subcategoria_id: "", fabricante_id: "", modelo_id: "",
        ano_fabricacao_padrao: undefined, capacidade: "", potencia: "", combustivel: "", cor_padrao: "",
        motor_padrao: "", descricao_padrao: "", imagem_url: "", ativo: true,
      });
    }
  }, [editingItem, isOpen]);

  const tipoOptions = useMemo(() => tipos.map((t) => ({ value: t.id, label: t.descricao_padronizada })), [tipos]);
  const categoriaOptions = useMemo(() => categorias.map((c) => ({ value: c.id, label: c.nome_categoria })), [categorias]);
  const subcategoriaOptions = useMemo(() => subcategorias.map((s: any) => ({ value: s.id, label: s.nome })), [subcategorias]);
  const fabricanteOptions = useMemo(() => fabricantes.map((f) => ({ value: f.id, label: f.nome })), [fabricantes]);
  const modeloOptions = useMemo(() => modelos.map((m) => ({ value: m.id, label: m.nome_modelo })), [modelos]);

  const handleSubmit = async (values: FormValues) => {
    await onSubmit({
      ...(editingItem ? { id: editingItem.id } : {}),
      ...values,
      categoria_id: values.categoria_id || null,
      subcategoria_id: values.subcategoria_id || null,
      fabricante_id: values.fabricante_id || null,
      modelo_id: values.modelo_id || null,
      ano_fabricacao_padrao: values.ano_fabricacao_padrao || null,
      capacidade: values.capacidade || null,
      potencia: values.potencia || null,
      combustivel: values.combustivel || null,
      cor_padrao: values.cor_padrao || null,
      motor_padrao: values.motor_padrao || null,
      descricao_padrao: values.descricao_padrao || null,
      imagem_url: (values as any).imagem_url || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Item do Catálogo" : "Novo Item no Catálogo"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="tipo_equipamento_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Equipamento *</FormLabel>
                <FormControl>
                  <Combobox options={tipoOptions} value={field.value} onChange={field.onChange} placeholder="Selecione o tipo" searchPlaceholder="Buscar..." emptyText="Nenhum encontrado" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="categoria_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <Combobox options={categoriaOptions} value={field.value || ""} onChange={(v) => { field.onChange(v); form.setValue("subcategoria_id", ""); }} placeholder="Selecione" searchPlaceholder="Buscar..." emptyText="Nenhuma" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="subcategoria_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategoria</FormLabel>
                  <FormControl>
                    <Combobox options={subcategoriaOptions} value={field.value || ""} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar..." emptyText="Nenhuma" />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fabricante_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fabricante</FormLabel>
                  <FormControl>
                    <Combobox options={fabricanteOptions} value={field.value || ""} onChange={(v) => { field.onChange(v); form.setValue("modelo_id", ""); }} placeholder="Selecione" searchPlaceholder="Buscar..." emptyText="Nenhum" />
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="modelo_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Combobox options={modeloOptions} value={field.value || ""} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar..." emptyText="Nenhum" />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="capacidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: 22t" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="potencia" render={({ field }) => (
                <FormItem>
                  <FormLabel>Potência</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: 160HP" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="combustivel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Combustível</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Diesel" /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="cor_padrao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor Padrão</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="motor_padrao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Motor Padrão</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="ano_fabricacao_padrao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano Fabricação</FormLabel>
                  <FormControl><Input type="number" min={1900} max={2100} {...field} value={field.value || ""} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="descricao_padrao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição Padrão</FormLabel>
                <FormControl><Textarea {...field} placeholder="Descrição técnica do template" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="imagem_url" render={({ field }) => (
              <FormItem>
                <FormLabel>URL da Imagem</FormLabel>
                <FormControl><Input {...field} placeholder="https://exemplo.com/imagem.jpg" /></FormControl>
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

export default CatalogoFormModal;
