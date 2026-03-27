import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SolicitacaoEquipamentoInsert } from "@/services/solicitacaoEquipamentoService";
import { useTiposEquipamentoDropdown } from "@/hooks/vehicles/useRelacionalDropdowns";
import { getCentrosCustoDropdown } from "@/services/veiculo/dropdownsRelacional";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { useMemo } from "react";

const schema = z.object({
  centro_custo_id: z.string().min(1, "Centro de custo é obrigatório"),
  tipo_equipamento_id: z.string().min(1, "Tipo de equipamento é obrigatório"),
  quantidade: z.coerce.number().min(1, "Quantidade mínima: 1"),
  data_inicio: z.string().min(1, "Data de início é obrigatória"),
  tempo_previsto_dias: z.coerce.number().optional(),
  regime_trabalho: z.string().optional(),
  com_operador: z.boolean().default(false),
  prioridade: z.enum(["NORMAL", "ALTA", "URGENTE"]).default("NORMAL"),
  justificativa: z.string().min(1, "Justificativa é obrigatória"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SolicitacaoEquipamentoInsert) => Promise<void>;
  isSubmitting: boolean;
}

const SolicitacaoEquipamentoFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
  const { data: tiposEquipamento = [] } = useTiposEquipamentoDropdown();
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros-custo-dropdown"],
    queryFn: getCentrosCustoDropdown,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      centro_custo_id: "",
      tipo_equipamento_id: "",
      quantidade: 1,
      data_inicio: "",
      tempo_previsto_dias: undefined,
      regime_trabalho: "",
      com_operador: false,
      prioridade: "NORMAL",
      justificativa: "",
    },
  });

  const ccOptions = useMemo(() => 
    centrosCusto.map((cc) => ({
      value: cc.id,
      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
    })),
    [centrosCusto]
  );

  const tipoOptions = useMemo(() =>
    tiposEquipamento.map((t) => ({
      value: t.id,
      label: t.descricao_padronizada,
    })),
    [tiposEquipamento]
  );

  const handleSubmit = async (values: FormValues) => {
    await onSubmit({
      centro_custo_id: values.centro_custo_id,
      tipo_equipamento_id: values.tipo_equipamento_id,
      quantidade: values.quantidade,
      data_inicio: values.data_inicio,
      tempo_previsto_dias: values.tempo_previsto_dias || null,
      regime_trabalho: values.regime_trabalho || null,
      com_operador: values.com_operador,
      prioridade: values.prioridade,
      justificativa: values.justificativa,
    });
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Equipamento</DialogTitle>
          <DialogDescription>
            Preencha os dados da solicitação. O sistema fará a busca automática de disponibilidade.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Centro de Custo */}
              <FormField control={form.control} name="centro_custo_id" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Centro de Custo *</FormLabel>
                  <FormControl>
                    <Combobox
                      options={ccOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Selecione o centro de custo"
                      searchPlaceholder="Buscar centro de custo..."
                      emptyText="Nenhum centro de custo encontrado"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Tipo Equipamento */}
              <FormField control={form.control} name="tipo_equipamento_id" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tipo de Equipamento *</FormLabel>
                  <FormControl>
                    <Combobox
                      options={tipoOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Selecione o tipo de equipamento"
                      searchPlaceholder="Buscar tipo..."
                      emptyText="Nenhum tipo encontrado"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Quantidade */}
              <FormField control={form.control} name="quantidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Data Início */}
              <FormField control={form.control} name="data_inicio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Início *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Tempo Previsto */}
              <FormField control={form.control} name="tempo_previsto_dias" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tempo Previsto (dias)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="Ex: 30" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Regime de Trabalho */}
              <FormField control={form.control} name="regime_trabalho" render={({ field }) => (
                <FormItem>
                  <FormLabel>Regime de Trabalho</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 8h/dia, 24h" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Prioridade */}
              <FormField control={form.control} name="prioridade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridade *</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NORMAL">Normal</SelectItem>
                        <SelectItem value="ALTA">Alta</SelectItem>
                        <SelectItem value="URGENTE">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Com Operador */}
              <FormField control={form.control} name="com_operador" render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 pt-6">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="cursor-pointer">Com operador</FormLabel>
                </FormItem>
              )} />
            </div>

            {/* Justificativa */}
            <FormField control={form.control} name="justificativa" render={({ field }) => (
              <FormItem>
                <FormLabel>Justificativa *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Descreva a necessidade do equipamento" className="min-h-[80px]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Solicitar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default SolicitacaoEquipamentoFormModal;
