
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRange } from "react-day-picker";
import { ApontamentoFilterParams } from "@/services/apontamentoCaminhoesService";
import { format } from "date-fns";
import { FilterX, Search } from "lucide-react";
import { 
  Drawer,
  DrawerContent, 
  DrawerHeader,
  DrawerTitle,
  DrawerFooter
} from "@/components/ui/drawer";

interface ApontamentoCaminhoesFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: ApontamentoFilterParams) => void;
  onClearFilters: () => void;
  veiculosOptions: { id: string; label: string; }[];
  operadoresOptions?: { id: string; label: string; }[];
  centrosCustoOptions?: { id: string; label: string; }[];
  isLoading?: boolean;
}

const ApontamentoCaminhoesFilterDrawer: React.FC<ApontamentoCaminhoesFilterDrawerProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  onClearFilters,
  veiculosOptions,
  operadoresOptions = [],
  centrosCustoOptions = [],
  isLoading = false
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [caminhaoId, setCaminhaoId] = useState<string>("");
  const [operadorId, setOperadorId] = useState<string>("");
  const [centroCustoId, setCentroCustoId] = useState<string>("");

  const applyFilters = () => {
    const filters: ApontamentoFilterParams = {};

    if (dateRange?.from) {
      filters.data_inicio = format(dateRange.from, "yyyy-MM-dd");
    }
    
    if (dateRange?.to) {
      filters.data_fim = format(dateRange.to, "yyyy-MM-dd");
    }

    if (caminhaoId && caminhaoId !== "_all") {
      filters.caminhao_equipamento_id = caminhaoId;
    }

    if (operadorId && operadorId !== "_all") {
      filters.operador_id = operadorId;
    }

    if (centroCustoId && centroCustoId !== "_all") {
      filters.centro_custo_id = centroCustoId;
    }

    onApplyFilters(filters);
    onClose();
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    setCaminhaoId("");
    setOperadorId("");
    setCentroCustoId("");
    onClearFilters();
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="px-4">
        <DrawerHeader className="text-left">
          <DrawerTitle>Filtros Avançados</DrawerTitle>
        </DrawerHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label htmlFor="date-range" className="font-medium text-gray-700">Período</Label>
            <DatePickerWithRange 
              value={dateRange} 
              onChange={setDateRange} 
              className="w-full border border-slate-300 rounded-md"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="caminhao" className="font-medium text-gray-700">Caminhão/Equipamento</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Select value={caminhaoId} onValueChange={setCaminhaoId}>
                <SelectTrigger id="caminhao" className="pl-8 border border-slate-300 bg-white w-full">
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="_all">Todos</SelectItem>
                  {veiculosOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="operador" className="font-medium text-gray-700">Operador</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Select value={operadorId} onValueChange={setOperadorId}>
                <SelectTrigger id="operador" className="pl-8 border border-slate-300 bg-white w-full">
                  <SelectValue placeholder="Selecione um operador" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="_all">Todos</SelectItem>
                  {operadoresOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="centro-custo" className="font-medium text-gray-700">Centro de Custo</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                <SelectTrigger id="centro-custo" className="pl-8 border border-slate-300 bg-white w-full">
                  <SelectValue placeholder="Selecione um centro" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="_all">Todos</SelectItem>
                  {centrosCustoOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DrawerFooter>
          <Button 
            variant="default" 
            onClick={applyFilters} 
            disabled={isLoading}
            className="w-full"
          >
            Aplicar Filtros
          </Button>
          <Button 
            variant="outline" 
            onClick={handleClearFilters} 
            disabled={isLoading}
            className="w-full border-slate-300"
          >
            <FilterX className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ApontamentoCaminhoesFilterDrawer;
