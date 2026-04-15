import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Filter } from "lucide-react";
import { OsFilterParams } from "@/types/ordemServico";

interface OsFiltersProps {
  onApplyFilters: (filters: OsFilterParams) => void;
  onClearFilters: () => void;
  veiculosOptions: { id: string; label: string }[];
  isLoading: boolean;
  showStatusFilter?: boolean;
  showPriorityFilter?: boolean;
}

const OsFilters: React.FC<OsFiltersProps> = ({
  onApplyFilters,
  onClearFilters,
  veiculosOptions,
  isLoading,
  showStatusFilter = false,
  showPriorityFilter = true
}) => {
  const [numeroOs, setNumeroOs] = useState("");
  const [caminhaoEquipamentoId, setCaminhaoEquipamentoId] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  const [prioridade, setPrioridade] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const filters: OsFilterParams = {};
    if (numeroOs) filters.numero_os = numeroOs;
    if (caminhaoEquipamentoId && caminhaoEquipamentoId !== "todos") filters.caminhao_equipamento_id = caminhaoEquipamentoId;
    if (dataInicio) filters.data_inicio = format(dataInicio, "yyyy-MM-dd");
    if (dataFim) filters.data_fim = format(dataFim, "yyyy-MM-dd");
    if (status && status !== "todos") filters.status = status;
    onApplyFilters(filters);
  }, [numeroOs, caminhaoEquipamentoId, dataInicio, dataFim, prioridade, status]);
  
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
            <Label>Número OS</Label>
            <Input
              placeholder="Buscar por número"
              value={numeroOs}
              onChange={(e) => setNumeroOs(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label>Caminhão/Equipamento</Label>
            <Select
              value={caminhaoEquipamentoId}
              onValueChange={setCaminhaoEquipamentoId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {veiculosOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label>Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${
                    !dataInicio && "text-muted-foreground"
                  }`}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? (
                    format(dataInicio, "dd/MM/yyyy", { locale: pt })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-1.5">
            <Label>Data Final</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${
                    !dataFim && "text-muted-foreground"
                  }`}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? (
                    format(dataFim, "dd/MM/yyyy", { locale: pt })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFim}
                  onSelect={setDataFim}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {showPriorityFilter && (
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={setPrioridade}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="Emergencial">Emergencial</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {showStatusFilter && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="Aberta">Aberta</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Concluída">Concluída</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OsFilters;
