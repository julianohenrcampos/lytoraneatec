import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateRange } from "react-day-picker";
import { ChamadoFilterParams } from "@/types/chamadoOS";
import { format } from "date-fns";
import { Filter, Search } from "lucide-react";

interface ChamadosFiltersProps {
  onApplyFilters: (filters: ChamadoFilterParams) => void;
  onClearFilters: () => void;
  veiculosOptions: { id: string; label: string; }[];
  isLoading?: boolean;
}

const ChamadosFilters: React.FC<ChamadosFiltersProps> = ({
  onApplyFilters,
  onClearFilters,
  veiculosOptions,
  isLoading = false
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [numeroChamado, setNumeroChamado] = useState<string>("");
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    applyFilters();
  }, [dateRange, numeroChamado, veiculoId, status]);

  const applyFilters = () => {
    const filters: ChamadoFilterParams = {};

    if (dateRange?.from) {
      filters.data_inicio = format(dateRange.from, "yyyy-MM-dd");
    }
    
    if (dateRange?.to) {
      filters.data_fim = format(dateRange.to, "yyyy-MM-dd");
    }

    if (numeroChamado) {
      filters.numero_chamado = numeroChamado;
    }

    if (veiculoId && veiculoId !== "_all") {
      filters.caminhao_equipamento_id = veiculoId;
    }

    if (status && status !== "_all") {
      filters.status = status;
    }

    onApplyFilters(filters);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Número do Chamado</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pelo número"
                value={numeroChamado}
                onChange={(e) => setNumeroChamado(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Caminhão/Equipamento</Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {veiculosOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Data da Solicitação</Label>
            <DatePickerWithRange 
              value={dateRange} 
              onChange={setDateRange} 
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                <SelectItem value="Aberto">Aberto</SelectItem>
                <SelectItem value="Convertido para OS">Convertido para OS</SelectItem>
                <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                <SelectItem value="Concluído">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChamadosFilters;
