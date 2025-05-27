
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { RegistroCarga } from "@/types/registroCargas";

interface DadosIniciaisTabProps {
  form: UseFormReturn<RegistroAplicacaoSchema>;
  onNext: () => void;
  registroCarga?: RegistroCarga | null;
}

const DadosIniciaisTab: React.FC<DadosIniciaisTabProps> = ({ 
  form, 
  onNext,
  registroCarga 
}) => {
  // Função para manipular a seleção de data sem deslocamento de timezone
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      form.setValue("data_aplicacao", "");
      return;
    }
    
    // Cria uma nova data com a hora meio-dia para evitar problemas de timezone
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    // Formata a data para o formato esperado yyyy-MM-dd
    form.setValue("data_aplicacao", format(normalizedDate, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_aplicacao">Data da Aplicação</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch("data_aplicacao") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("data_aplicacao") ? (
                  format(new Date(form.watch("data_aplicacao")), "dd/MM/yyyy", { locale: ptBR })
                ) : (
                  <span>Selecione uma data</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.watch("data_aplicacao") ? new Date(form.watch("data_aplicacao")) : undefined}
                onSelect={handleDateSelect}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hora_chegada_local">Hora da Chegada ao Local</Label>
          <Input
            id="hora_chegada_local"
            type="time"
            {...form.register("hora_chegada_local")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="temperatura_chegada">Temperatura da Massa na Chegada (°C)</Label>
          <Input
            id="temperatura_chegada"
            type="number"
            {...form.register("temperatura_chegada", { valueAsNumber: true })}
          />
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Próximo
        </Button>
      </div>
    </div>
  );
};

export default DadosIniciaisTab;
