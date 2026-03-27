import React, { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { getEquipamentosDropdown, DisponibilidadeEquipamento } from "@/services/disponibilidadeEquipamentoService";
import { getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";

const schema = z.object({
  equipamento_id: z.string().min(1, "Equipamento é obrigatório"),
  status_operacional: z.string().min(1, "Status é obrigatório"),
  centro_custo_id: z.string().optional(),
  data_inicio: z.string().optional(),
  previsao_liberacao: z.string().optional(),
  confiabilidade_previsao: z.string().optional(),
  motivo_risco: z.string().optional(),
  observacao: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  editingItem: DisponibilidadeEquipamento | null;
}

const DisponibilidadeFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, isSubmitting, editingItem }) => {
  const { data: equipamentos = [] } = useQuery({ queryKey: ["equipamentos-dd"], queryFn: getEquipamentosDropdown });
  const { data: centrosCusto = [] } = useQuery({ queryKey: ["cc-dd"], queryFn: getCentrosCustoDropdown });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { equipamento_id: "", status_operacional: "", centro_custo_id: "", data_inicio: "", previsao_liberacao: "", confiabilidade_previsao: "", motivo_risco: "", observacao: "" },
  });

  useEffect(() => {
    if (editingItem) {
      form.reset({
        equipamento_id: editingItem.equipamento_id,
        status_operacional: editingItem.status_operacional,
        centro_custo_id: editingItem.centro_custo_id || "",
        data_inicio: editingItem.data_inicio || "",
        previsao_liberacao: editingItem.previsao_liberacao || "",
        confiabilidade_previsao: editingItem.confiabilidade_previsao || "",
        motivo_risco: editingItem.motivo_risco || "",
        observacao: editingItem.observacao || "",
      });
    } else {
      form.reset({ equipamento_id: "", status_operacional: "", centro_custo_id: "", data_inicio: "", previsao_liberacao: "", confiabilidade_previsao: "", motivo_risco: "", observacao: "" });
    }
  }, [editingItem, isOpen]);

  const equipOptions = useMemo(() => equipamentos.map((e) => ({ value: e.id, label: `${e.frota || ""}${e.numero_frota ? `-${e.numero_frota}` : ""} (${e.id.slice(0, 6)})` })), [equipamentos]);
  const ccOptions = useMemo(() => centrosCusto.map((c) => ({ value: c.id, label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}` })), [centrosCusto]);

  const handleSubmit = async (values: FormValues) => {
    await onSubmit({
      ...(editingItem ? { id: editingItem.id } : {}),
      equipamento_id: values.equipamento_id,
      status_operacional: values.status_operacional,
      centro_custo_id: values.centro_custo_id || null,
      data_inicio: values.data_inicio || null,
      previsao_liberacao: values.previsao_liberacao || null,
      confiabilidade_previsao: values.confiabilidade_previsao || null,
      motivo_risco: values.motivo_risco || null,
      observacao: values.observacao || null,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Disponibilidade" : "Nova Disponibilidade"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="equipamento_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Equipamento *</FormLabel>
                <FormControl>
                  {editingItem ? (
                    <Input value={`${editingItem.equipamento_codigo_frota || ""}-${editingItem.equipamento_numero_frota || ""}`} readOnly className="bg-muted" />
                  ) : (
                    <Combobox options={equipOptions} value={field.value} onChange={field.onChange} placeholder="Selecione o equipamento" searchPlaceholder="Buscar..." emptyText="Nenhum encontrado" />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="status_operacional" render={({ field }) => (
              <FormItem>
                <FormLabel>Status Operacional *</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                      <SelectItem value="ALOCADO">Alocado</SelectItem>
                      <SelectItem value="MANUTENCAO">Manutenção</SelectItem>
                      <SelectItem value="INDISPONIVEL">Indisponível</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="centro_custo_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Centro de Custo</FormLabel>
                <FormControl>
                  <Combobox options={ccOptions} value={field.value || ""} onChange={field.onChange} placeholder="Selecione" searchPlaceholder="Buscar..." emptyText="Nenhum encontrado" />
                </FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="data_inicio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Início</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="previsao_liberacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Previsão Liberação</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="confiabilidade_previsao" render={({ field }) => (
              <FormItem>
                <FormLabel>Confiabilidade da Previsão</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="BAIXA">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="motivo_risco" render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo / Risco</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Aguardando peça" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="observacao" render={({ field }) => (
              <FormItem>
                <FormLabel>Observação</FormLabel>
                <FormControl><Textarea {...field} placeholder="Observações adicionais" /></FormControl>
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

export default DisponibilidadeFormModal;
