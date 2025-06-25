
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  parseBrazilianDate 
} from "@/utils/timezoneUtils";
import { FuncionarioFormData, Funcionario } from "@/types/funcionario";

interface PessoalTabProps {
  form: UseFormReturn<FuncionarioFormData>;
  funcionario?: Funcionario | null;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  isUploadingImage: boolean;
  setIsUploadingImage: (uploading: boolean) => void;
}

export default function PessoalTab({ form }: PessoalTabProps) {
  const handleDateChange = (field: any, date: Date | undefined) => {
    if (date) {
      const normalizedDate = normalizeDateToBrazilianNoon(date);
      const dateString = formatBrazilianDateToString(normalizedDate);
      field.onChange(dateString);
    } else {
      field.onChange(null);
    }
  };

  const getDateValue = (dateString: string | null) => {
    if (!dateString) return undefined;
    try {
      return parseBrazilianDate(dateString);
    } catch (error) {
      console.error("Erro ao fazer parse da data:", error);
      return undefined;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nome Completo */}
        <FormField
          control={form.control}
          name="nome_completo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo *</FormLabel>
              <FormControl>
                <Input placeholder="Digite o nome completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* CPF */}
        <FormField
          control={form.control}
          name="cpf"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CPF</FormLabel>
              <FormControl>
                <Input placeholder="000.000.000-00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* RG */}
        <FormField
          control={form.control}
          name="rg"
          render={({ field }) => (
            <FormItem>
              <FormLabel>RG</FormLabel>
              <FormControl>
                <Input placeholder="00.000.000-0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Data de Nascimento */}
        <FormField
          control={form.control}
          name="data_nascimento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Nascimento</FormLabel>
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
                      {field.value ? (
                        format(getDateValue(field.value) || new Date(), "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        "Selecione a data"
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={getDateValue(field.value)}
                    onSelect={(date) => handleDateChange(field, date)}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Estado Civil */}
        <FormField
          control={form.control}
          name="estado_civil"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado Civil</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Solteiro">Solteiro</SelectItem>
                  <SelectItem value="Casado">Casado</SelectItem>
                  <SelectItem value="Divorciado">Divorciado</SelectItem>
                  <SelectItem value="Viúvo">Viúvo</SelectItem>
                  <SelectItem value="União Estável">União Estável</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Telefone */}
        <FormField
          control={form.control}
          name="telefone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input placeholder="(00) 00000-0000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="email@exemplo.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Endereço */}
        <FormField
          control={form.control}
          name="endereco"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Endereço</FormLabel>
              <FormControl>
                <Input placeholder="Rua, número, bairro, cidade - CEP" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
