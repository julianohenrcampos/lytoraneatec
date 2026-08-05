
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { Combobox } from "@/components/ui/combobox";
import { DateRange } from "react-day-picker";
import { ApontamentoFilterParams } from "@/services/apontamentoCaminhoesService";
import { format } from "date-fns";
import { FilterX, SlidersHorizontal } from "lucide-react";
import { useIsSmallScreen, useIsMobile } from "@/hooks/use-mobile";
import ApontamentoCaminhoesFilterDrawer from "./ApontamentoCaminhoesFilterDrawer";

interface ApontamentoCaminhoesFiltersProps {
  onApplyFilters: (filters: ApontamentoFilterParams) => void;
  onClearFilters: () => void;
  onExportToExcel?: () => void;
  veiculosOptions: { id: string; label: string; searchText?: string }[];
  operadoresOptions?: { id: string; label: string; searchText?: string }[];
  centrosCustoOptions?: { id: string; label: string; searchText?: string }[];
  isLoading?: boolean;
}

const ApontamentoCaminhoesFilters: React.FC<ApontamentoCaminhoesFiltersProps> = ({
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
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  // Apply filters whenever any filter value changes
  useEffect(() => {
    if (!isMobile) {
      applyFilters();
    }
  }, [dateRange, caminhaoId, operadorId, centroCustoId]);

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
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    setCaminhaoId("");
    setOperadorId("");
    setCentroCustoId("");
    onClearFilters();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  };

  if (isMobile) {
    return (
      <>
        <div className="fixed top-24 right-4 z-10">
          <Button 
            onClick={() => setIsFilterDrawerOpen(true)} 
            className="rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 h-[32px] w-[100px]"
            size="sm"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
        
        <ApontamentoCaminhoesFilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          onApplyFilters={onApplyFilters}
          onClearFilters={onClearFilters}
          veiculosOptions={veiculosOptions}
          operadoresOptions={operadoresOptions}
          centrosCustoOptions={centrosCustoOptions}
          isLoading={isLoading}
        />
      </>
    );
  }

  return (
    <Card className="mb-6 border border-slate-200 shadow-sm">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" onKeyDown={handleKeyDown}>
          <div className="space-y-2">
            <Label htmlFor="date-range" className="font-medium text-gray-700">Período</Label>
            <DatePickerWithRange 
              value={dateRange} 
              onChange={setDateRange} 
              className="border border-slate-300 rounded-md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caminhao" className="font-medium text-gray-700">Caminhão/Equipamento</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...veiculosOptions.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText ?? o.label })),
              ]}
              value={caminhaoId}
              onChange={setCaminhaoId}
              placeholder="Selecione um veículo"
              searchPlaceholder="Buscar veículo..."
              emptyText="Nenhum veículo encontrado"
              className="border border-slate-300 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="operador" className="font-medium text-gray-700">Operador</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...operadoresOptions.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText ?? o.label })),
              ]}
              value={operadorId}
              onChange={setOperadorId}
              placeholder="Selecione um operador"
              searchPlaceholder="Buscar operador..."
              emptyText="Nenhum operador encontrado"
              className="border border-slate-300 bg-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="centro-custo" className="font-medium text-gray-700">Centro de Custo</Label>
            <Combobox
              options={[
                { value: "_all", label: "Todos" },
                ...centrosCustoOptions.map((o) => ({ value: o.id, label: o.label, searchText: o.searchText ?? o.label })),
              ]}
              value={centroCustoId}
              onChange={setCentroCustoId}
              placeholder="Selecione um centro"
              searchPlaceholder="Buscar centro de custo..."
              emptyText="Nenhum centro de custo encontrado"
              className="border border-slate-300 bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button 
            variant="outline" 
            onClick={handleClearFilters} 
            disabled={isLoading}
            className="border-slate-300"
          >
            <FilterX className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
        
        <div className="mt-2 text-center text-sm text-slate-500 italic">
          {"\n"}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApontamentoCaminhoesFilters;
