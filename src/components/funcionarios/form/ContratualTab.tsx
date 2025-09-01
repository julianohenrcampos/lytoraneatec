import React from "react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  normalizeDateToBrazilianNoon,
  formatBrazilianDateToString,
  parseBrazilianDate,
} from "@/utils/timezoneUtils";
import { FuncionarioFormData } from "@/types/funcionario";

interface ContratualTabProps {
  form: UseFormReturn<FuncionarioFormData>;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

type RHField = {
  onChange: (v: any) => void;
  value?: any;
};

interface DatePickerFieldProps {
  field: RHField;
  label: string;
  disableFuture?: boolean;
  disablePastBeforeYear?: number; // se quiser bloquear datas antes de um ano específico
}

export default function ContratualTab({
  form,
  onClose,
  setActiveTab,
}: ContratualTabProps) {
  const handleDateChange = (field: RHField, date: Date | undefined) => {
    if (date) {
      const normalizedDate = normalizeDateToBrazilianNoon(date);
      const dateString = formatBrazilianDateToString(normalizedDate);
      field.onChange(dateString);
    } else {
      field.onChange(null);
    }
  };

  const getDateValue = (dateString: string | null | undefined): Date | undefined => {
    if (!dateString) return undefined;
    try {
      return parseBrazilianDate(dateString);
    } catch (error) {
      console.error("Erro ao fazer parse da data:", error);
      return undefined;
    }
  };

  // Props extras que queremos passar ao Calendar para conseguir o visual com dropdown de mês/ano e locale.
  // Fazemos cast para any para evitar erros de tipagem caso sua implementação local do Calendar não declare essas props.
  const extraCalendarProps: any = {
    captionLayout: "dropdown",
    fromYear: 1900,
    toYear: 2100,
    locale: ptBR,
    className: "rounded-md border shadow-md",
  };

  const DatePickerField: React.FC<DatePickerFieldProps> = ({
    field,
    label,
    disableFuture,
    disablePastBeforeYear,
  }) => {
    const disabledPredicate = (date: Date) => {
      if (disableFuture && date > new Date()) return true;
      if (
        disablePastBeforeYear &&
        date < new Date(`${disablePastBeforeYear}-01-01`)
      )
        return true;
      return false;
    };

    const displayLabel =
      field.value && getDateValue(field.value)
        ? format(getDateValue(field.value) as Date, "dd/MM/yyyy", { locale: ptBR })
        : "Selecione a data";

    return (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Popover>
          <PopoverTrigger asChild>
            <FormControl>
              <Button
                variant="outline"
                className={cn(
                  "w-full pl-3 text-left font-normal",
                  !field.value && "text-muted-foreground"
                )}
              >
                {displayLabel}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </FormControl>
          </PopoverTrigger>

          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={getDateValue(field.value)}
              onSelect={(date) => handleDateChange(field, date)}
              disabled={disabledPredicate}
              initialFocus
              {...(extraCalendarProps as any)}
            />
          </PopoverContent>
        </Popover>
        <FormMessage />
      </FormItem>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Data de Admissão */}
        <FormField
          control={form.control}
          name="data_admissao"
          render={({ field }) => (
            <DatePickerField field={field as RHField} label="Data de Admissão" disableFuture />
          )}
        />

        {/* Salário Base */}
        <FormField
          control={form.control}
          name="salario_base"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Salário Base</FormLabel>
              <FormControl>
                <Input
                  value={field.value ?? ""}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  onChange={(e) =>
                    field.onChange(
                      e.target.value ? parseFloat(e.target.value as string) : undefined
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data de Férias */}
        <FormField
          control={form.control}
          name="data_ferias"
          render={({ field }) => (
            <DatePickerField field={field as RHField} label="Data de Férias" />
          )}
        />

        {/* Status */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Aviso Prévio">Aviso Prévio</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data de Demissão */}
        <FormField
          control={form.control}
          name="data_demissao"
          render={({ field }) => (
            <DatePickerField
              field={field as RHField}
              label="Data de Demissão"
              disablePastBeforeYear={1900}
            />
          )}
        />
      </div>

      {/* Navegação */}
      <div className="flex justify-between gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => setActiveTab("profissional")}>
          Anterior
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => setActiveTab("financeiro")}>
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}
