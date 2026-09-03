import React, { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useFabricantesRelacionalDropdown } from "@/hooks/vehicles/useRelacionalDropdowns";

interface Props {
  form: UseFormReturn<any>;
}

const Step3DadosTecnicos: React.FC<Props> = ({ form }) => {
  const { data: fabricantesData = [], isLoading: isLoadingFabricantes } = useFabricantesRelacionalDropdown();

  const fabricanteOptions = useMemo(() => [
    { value: "_none", label: "Nenhum" },
    ...fabricantesData.map((f) => ({ value: f.id, label: f.nome })),
  ], [fabricantesData]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          ⚙️ Dados Técnicos
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="fabricante_id" render={({ field }) => (
            <FormItem>
              <FormLabel>Fabricante</FormLabel>
              <FormControl>
                <Combobox
                  options={fabricanteOptions}
                  value={field.value || "_none"}
                  onChange={field.onChange}
                  placeholder={isLoadingFabricantes ? "Carregando..." : "Selecione o fabricante"}
                  searchPlaceholder="Buscar fabricante..."
                  emptyText="Nenhum fabricante encontrado"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="modelo" render={({ field }) => (
            <FormItem>
              <FormLabel>Modelo</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: FH 540, Actros 2651, CS54B..."
                  maxLength={120}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />


          {/* Ano de Fabricação */}
          <FormField control={form.control} name="ano_fabricacao" render={({ field }) => (
            <FormItem>
              <FormLabel>Ano de Fabricação</FormLabel>
              <FormControl>
                <Input placeholder="2023/2024" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Cor */}
          <FormField control={form.control} name="cor" render={({ field }) => (
            <FormItem>
              <FormLabel>Cor</FormLabel>
              <FormControl>
                <Input placeholder="Branco, Amarelo, etc." {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Motor */}
          <FormField control={form.control} name="motor" render={({ field }) => (
            <FormItem>
              <FormLabel>Motor</FormLabel>
              <FormControl>
                <Input placeholder="Especificações do motor" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Tipo de Combustível */}
          <FormField control={form.control} name="tipo_combustivel" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Combustível</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o combustível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="Diesel S10">Diesel S10</SelectItem>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Etanol">Etanol</SelectItem>
                    <SelectItem value="Flex">Flex</SelectItem>
                    <SelectItem value="GNV">GNV</SelectItem>
                    <SelectItem value="Elétrico">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>
    </div>
  );
};

export default Step3DadosTecnicos;
