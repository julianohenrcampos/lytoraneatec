import React, { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";

interface Props {
  form: UseFormReturn<any>;
  departamentos: { id: string; nome_departamento: string }[];
  empresas: { id: string; nome_empresa: string }[];
}

const Step4Operacao: React.FC<Props> = ({ form, departamentos, empresas }) => {
  const departamentoOptions = useMemo(() => [
    { value: "_none", label: "Nenhum" },
    ...departamentos.map((d) => ({ value: d.id, label: d.nome_departamento })),
  ], [departamentos]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          📊 Operação
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Situação */}
          <FormField control={form.control} name="situacao" render={({ field }) => (
            <FormItem>
              <FormLabel>Situação *</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Operando">Operando</SelectItem>
                    <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                    <SelectItem value="Disponível">Disponível</SelectItem>
                    <SelectItem value="Intempérie">Intempérie</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Status IPVA */}
          <FormField control={form.control} name="status_ipva" render={({ field }) => (
            <FormItem>
              <FormLabel>Status IPVA</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />


          {/* Departamento */}
          <FormField control={form.control} name="departamento_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Departamento</FormLabel>
              <FormControl>
                <Combobox
                  options={departamentoOptions}
                  value={field.value || "_none"}
                  onChange={field.onChange}
                  placeholder="Selecione um departamento"
                  searchPlaceholder="Buscar departamento..."
                  emptyText="Nenhum departamento encontrado"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Capacidade */}
          <FormField control={form.control} name="capacidade" render={({ field }) => (
            <FormItem>
              <FormLabel>Capacidade</FormLabel>
              <FormControl>
                <Input placeholder="Capacidade máxima" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Aluguel */}
          <FormField control={form.control} name="aluguel" render={({ field }) => (
            <FormItem>
              <FormLabel>Aluguel (se aplicável)</FormLabel>
              <FormControl>
                <Input placeholder="Valor do aluguel" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {/* Observações */}
        <FormField control={form.control} name="observacoes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações adicionais" className="resize-none min-h-[80px]" {...field} value={field.value || ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
};

export default Step4Operacao;
