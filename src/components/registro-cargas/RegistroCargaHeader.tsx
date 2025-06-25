
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Clock, User, MapPin, CalendarIcon } from "lucide-react";
import { RegistroCarga } from "@/types/registroCargas";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  parseBrazilianDate 
} from "@/utils/timezoneUtils";
import { UseFormReturn } from "react-hook-form";

interface RegistroCargaHeaderProps {
  form: UseFormReturn<any>;
  currentEntrega: ListaProgramacaoEntrega;
  centroCustoInfo: string;
}

export default function RegistroCargaHeader({
  form,
  currentEntrega,
  centroCustoInfo,
}: RegistroCargaHeaderProps) {
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      const normalizedDate = normalizeDateToBrazilianNoon(date);
      const dateString = formatBrazilianDateToString(normalizedDate);
      form.setValue("data_saida", dateString);
    }
  };

  const getDateValue = () => {
    const dateString = form.watch("data_saida");
    if (!dateString) return undefined;
    try {
      return parseBrazilianDate(dateString);
    } catch (error) {
      console.error("Erro ao fazer parse da data:", error);
      return undefined;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Em Preparação":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Carregado":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Em Trânsito":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Entregue":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Detalhes da Carga
          </CardTitle>
          <Badge className={getStatusColor(currentEntrega.status || "Ativa")}>
            {currentEntrega.status || "Ativa"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Informações da Entrega */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Truck className="h-4 w-4" />
              Entrega
            </div>
            <div>
              <p className="font-semibold">
                {currentEntrega.logradouro}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentEntrega.bairro || "Bairro não informado"}
              </p>
            </div>
          </div>

          {/* Data de Saída */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              Data de Saída
            </div>
            <div>
              <Label htmlFor="data_saida" className="text-xs">Data de Saída</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.watch("data_saida") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("data_saida") 
                      ? format(getDateValue() || new Date(), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={getDateValue()}
                    onSelect={handleDateChange}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Horários */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Horários
            </div>
            <div>
              <div>
                <Label htmlFor="hora_saida" className="text-xs">Hora Saída</Label>
                <Input
                  id="hora_saida"
                  type="time"
                  {...form.register("hora_saida")}
                />
              </div>
            </div>
          </div>

          {/* Centro de Custo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Centro de Custo
            </div>
            <div>
              <p className="font-semibold">
                {centroCustoInfo}
              </p>
            </div>
          </div>

          {/* Temperatura */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Temperatura
            </div>
            <div>
              <Label htmlFor="temperatura_saida" className="text-xs">Temperatura Saída (°C)</Label>
              <Input
                id="temperatura_saida"
                type="number"
                step="0.1"
                {...form.register("temperatura_saida")}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
