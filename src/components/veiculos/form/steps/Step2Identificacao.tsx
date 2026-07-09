import React, { useMemo, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { useFrotasDropdown, getFrotaTipoFromRecord, getFrotaLabelFromTipo } from "@/hooks/vehicles/useFrotasDropdown";
import { useProprietariosUnificados, buildProprietarioKey } from "@/hooks/vehicles/useProprietariosUnificados";
import { AlertCircle } from "lucide-react";

interface Props {
  form: UseFormReturn<any>;
}

const Step2Identificacao: React.FC<Props> = ({ form }) => {
  const frotaId = form.watch("frota_id");
  const proprietarioKey = form.watch("proprietario_key") as string | undefined;
  const empresaIdWatched = form.watch("empresa_id") as string | undefined;
  const empresaLocadoraIdWatched = form.watch("empresa_locadora_id") as string | undefined;

  const { data: frotasList = [] } = useFrotasDropdown();
  const { data: proprietarios = [], isLoading: isLoadingProps } = useProprietariosUnificados();

  const selectedFrota = useMemo(
    () => frotasList.find((f) => f.id === frotaId) || null,
    [frotasList, frotaId]
  );

  const labelProprietario = getFrotaLabelFromTipo(selectedFrota?.tipo_propriedade_padrao);

  // Auto-set frota text field from selected frota (mantém sigla legada)
  useEffect(() => {
    if (selectedFrota) {
      form.setValue("frota", selectedFrota.codigo);
    }
  }, [selectedFrota, form]);

  // Hidratar proprietario_key a partir dos campos existentes (edição)
  useEffect(() => {
    if (!proprietarioKey && (empresaIdWatched || empresaLocadoraIdWatched)) {
      const key = buildProprietarioKey({
        empresa_id: empresaIdWatched || null,
        empresa_locadora_id: empresaLocadoraIdWatched || null,
      });
      if (key) form.setValue("proprietario_key", key);
    }
  }, [proprietarioKey, empresaIdWatched, empresaLocadoraIdWatched, form]);

  // Limpar apenas se o valor selecionado não existir mais na lista unificada
  useEffect(() => {
    if (!proprietarioKey || proprietarios.length === 0) return;
    const exists = proprietarios.some((p) => p.key === proprietarioKey);
    if (!exists) {
      form.setValue("proprietario_key", "");
      form.setValue("empresa_id", "");
      form.setValue("empresa_locadora_id", "");
    }
  }, [proprietarioKey, proprietarios, form]);

  const proprietarioOptions = useMemo(
    () =>
      proprietarios.map((p) => ({
        value: p.key,
        label: p.nome,
        group: p.grupo,
        searchText: `${p.nome} ${p.grupo}`,
      })),
    [proprietarios]
  );

  const frotaOptions = useMemo(
    () => [
      { value: "_none", label: "Selecione a frota" },
      ...frotasList.map((f) => ({
        value: f.id,
        label: `${f.codigo} — ${
          f.tipo_propriedade_padrao === "PROPRIO"
            ? "Próprio"
            : f.tipo_propriedade_padrao === "GRUPO"
            ? "Grupo"
            : "Locado"
        }`,
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

          {/* Proprietário — lista unificada (empresas + locadoras), independente da frota */}
          <FormField
            control={form.control}
            name="proprietario_key"
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
                  <Combobox
                    options={proprietarioOptions}
                    value={field.value || ""}
                    onChange={(val) => {
                      field.onChange(val);
                      const selected = proprietarios.find((p) => p.key === val);
                      if (selected?.origem === "empresa") {
                        form.setValue("empresa_id", selected.id);
                        form.setValue("empresa_locadora_id", "");
                      } else if (selected?.origem === "locadora") {
                        form.setValue("empresa_locadora_id", selected.id);
                        form.setValue("empresa_id", "");
                      } else {
                        form.setValue("empresa_id", "");
                        form.setValue("empresa_locadora_id", "");
                      }
                    }}
                    placeholder={isLoadingProps ? "Carregando..." : "Selecione o proprietário..."}
                    searchPlaceholder="Buscar por nome..."
                    emptyText="Nenhum proprietário encontrado"
                  />
                </FormControl>
                {proprietarios.length === 0 && !isLoadingProps && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Nenhum proprietário cadastrado
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

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
