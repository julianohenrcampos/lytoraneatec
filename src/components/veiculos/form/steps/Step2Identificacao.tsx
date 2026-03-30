import React, { useMemo, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useFrotasDropdown, getFrotaTipoFromRecord, getFrotaLabelFromTipo } from "@/hooks/vehicles/useFrotasDropdown";
import { useEmpresasByFrota } from "@/hooks/vehicles/useEmpresasByFrota";
import { AlertCircle } from "lucide-react";

interface Props {
  form: UseFormReturn<any>;
}

const Step2Identificacao: React.FC<Props> = ({ form }) => {
  const frotaId = form.watch("frota_id");
  const { data: frotasList = [], isLoading: isLoadingFrotas } = useFrotasDropdown();

  // Find selected frota record
  const selectedFrota = useMemo(
    () => frotasList.find((f) => f.id === frotaId) || null,
    [frotasList, frotaId]
  );

  const frotaCodigo = selectedFrota?.codigo || null;
  const frotaTipo = getFrotaTipoFromRecord(selectedFrota?.tipo_propriedade_padrao);
  const labelProprietario = getFrotaLabelFromTipo(selectedFrota?.tipo_propriedade_padrao);

  // Use the existing hook — pass the codigo for empresa filtering
  const { data: empresas = [], isLoading: isLoadingEmpresas } = useEmpresasByFrota(frotaCodigo);

  // Auto-set frota text field from selected frota
  useEffect(() => {
    if (selectedFrota) {
      form.setValue("frota", selectedFrota.codigo);
    }
  }, [selectedFrota, form]);

  // Auto-select empresa when PROPRIO and only one option
  useEffect(() => {
    if (frotaTipo === "PROPRIO" && empresas.length === 1) {
      form.setValue("empresa_id", empresas[0].id);
    }
  }, [frotaTipo, empresas, form]);

  // Reset empresa when frota changes
  useEffect(() => {
    const currentEmpresa = form.getValues("empresa_id");
    if (currentEmpresa && empresas.length > 0) {
      const exists = empresas.some((e) => e.id === currentEmpresa);
      if (!exists) {
        form.setValue("empresa_id", "");
      }
    }
  }, [frotaId, empresas, form]);

  const empresaOptions = useMemo(
    () => [
      { value: "_none", label: "Selecione" },
      ...empresas.map((e) => ({ value: e.id, label: e.nome_empresa })),
    ],
    [empresas]
  );

  const frotaOptions = useMemo(
    () => [
      { value: "_none", label: "Selecione a frota" },
      ...frotasList.map((f) => ({
        value: f.id,
        label: `${f.codigo} — ${f.tipo_propriedade_padrao === "PROPRIO" ? "Próprio" : f.tipo_propriedade_padrao === "GRUPO" ? "Grupo" : "Locado"}`,
      })),
    ],
    [frotasList]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          🆔 Identificação
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Frota (relacional) */}
          <FormField
            control={form.control}
            name="frota_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Frota *</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={(val) => field.onChange(val === "_none" ? "" : val)}
                    value={field.value || "_none"}
                  >
                    <SelectTrigger className="border-primary/40 font-semibold">
                      <SelectValue placeholder="Selecione a frota" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {frotaOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription className="text-xs">
                  Define o tipo de operação (Próprio / Grupo / Locado)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Número Frota */}
          <FormField
            control={form.control}
            name="numero_frota"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número Frota</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: 001" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Proprietário (filtrado por frota) */}
          {frotaId && frotaId !== "_none" && (
            <FormField
              control={form.control}
              name="empresa_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Proprietário *{" "}
                    {labelProprietario && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        — {labelProprietario}
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    {frotaTipo === "PROPRIO" && empresas.length === 1 ? (
                      <Input
                        value={empresas[0].nome_empresa}
                        readOnly
                        className="bg-muted/30 text-muted-foreground text-sm"
                      />
                    ) : (
                      <Combobox
                        options={empresaOptions}
                        value={field.value || "_none"}
                        onChange={field.onChange}
                        placeholder={isLoadingEmpresas ? "Carregando..." : "Buscar empresa..."}
                        searchPlaceholder="Buscar empresa..."
                        emptyText="Nenhuma empresa encontrada"
                      />
                    )}
                  </FormControl>
                  {empresas.length === 0 && !isLoadingEmpresas && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      Nenhum fornecedor disponível para esta frota
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Placa */}
          <FormField
            control={form.control}
            name="placa"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Placa</FormLabel>
                <FormControl>
                  <Input placeholder="ABC-1234" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Chassi */}
          <FormField
            control={form.control}
            name="chassi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chassi</FormLabel>
                <FormControl>
                  <Input placeholder="Número do chassi" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Step2Identificacao;
