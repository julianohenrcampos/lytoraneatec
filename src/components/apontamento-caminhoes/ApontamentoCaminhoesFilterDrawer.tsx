
import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { Combobox } from "@/components/ui/combobox";
import { DateRange } from "react-day-picker";
import { ApontamentoFilterParams } from "@/services/apontamentoCaminhoesService";
import { format } from "date-fns";
import { FilterX } from "lucide-react";

interface ApontamentoCaminhoesFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: ApontamentoFilterParams) => void;
  onClearFilters: () => void;
  veiculosOptions: { id: string; label: string; searchText?: string }[];
  operadoresOptions?: { id: string; label: string; searchText?: string }[];
  centrosCustoOptions?: { id: string; label: string; searchText?: string }[];
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
  
  // Reset filters when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset states but don't trigger filter reset
    setDateRange(undefined);
    setCaminhaoId("");
    setOperadorId("");
    setCentroCustoId("");
  }, [isOpen]);

  const handleApplyFilters = () => {
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
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[85vw] sm:w-[350px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros Avançados</SheetTitle>
        </SheetHeader>
        
        <div className="py-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="date-range-mobile" className="font-medium text-gray-700">Período</Label>
            <DatePickerWithRange 
              value={dateRange} 
              onChange={setDateRange} 
              className="border border-slate-300 rounded-md w-full h-12"
              id="date-range-mobile"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caminhao-mobile" className="font-medium text-gray-700">Caminhão/Equipamento</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...veiculosOptions.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText ?? o.label })),
              ]}
              value={caminhaoId}
              onChange={setCaminhaoId}
              placeholder="Selecione"
              searchPlaceholder="Buscar veículo..."
              emptyText="Nenhum veículo encontrado"
              className="h-12 border border-slate-300 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="operador-mobile" className="font-medium text-gray-700">Operador</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...operadoresOptions.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText ?? o.label })),
              ]}
              value={operadorId}
              onChange={setOperadorId}
              placeholder="Selecione"
              searchPlaceholder="Buscar operador..."
              emptyText="Nenhum operador encontrado"
              className="h-12 border border-slate-300 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="centro-custo-mobile" className="font-medium text-gray-700">Centro de Custo</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...centrosCustoOptions.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText ?? o.label })),
              ]}
              value={centroCustoId}
              onChange={setCentroCustoId}
              placeholder="Selecione"
              searchPlaceholder="Buscar centro de custo..."
              emptyText="Nenhum centro de custo encontrado"
              className="h-12 border border-slate-300 bg-white"
            />
          </div>
        </div>

        <SheetFooter className="sm:justify-between gap-3">
          <Button 
            variant="outline" 
            onClick={handleClearFilters} 
            disabled={isLoading}
            className="w-full h-12"
          >
            <FilterX className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
          
          <Button 
            onClick={handleApplyFilters} 
            disabled={isLoading}
            className="w-full h-12"
          >
            Aplicar Filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ApontamentoCaminhoesFilterDrawer;
