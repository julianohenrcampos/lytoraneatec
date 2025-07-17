
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ProgramacaoEntregaFilters as FiltersType } from "@/types/programacaoEntrega";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  formatBrazilianDateForDisplay 
} from "@/utils/timezoneUtils";

interface FiltersProps {
  filters: FiltersType;
  onFilterChange: (name: keyof FiltersType, value: any) => void;
  onResetFilters: () => void;
}

const ProgramacaoEntregaFilters: React.FC<FiltersProps> = ({ 
  filters, 
  onFilterChange, 
  onResetFilters 
}) => {
  const [centrosCusto, setCentrosCusto] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(
    filters.data_inicio ? filters.data_inicio : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    filters.data_fim ? filters.data_fim : undefined
  );

  // Load centers
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load centros de custo
        const { data: centrosData, error: centrosError } = await supabase
          .from('bd_centros_custo')
          .select('id, nome_centro_custo');
          
        if (centrosError) throw centrosError;
        setCentrosCusto(centrosData || []);
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    };
    
    loadData();
  }, []);

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      const normalizedDate = normalizeDateToBrazilianNoon(date);
      onFilterChange('data_inicio', normalizedDate);
    } else {
      onFilterChange('data_inicio', undefined);
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      const normalizedDate = normalizeDateToBrazilianNoon(date);
      onFilterChange('data_fim', normalizedDate);
    } else {
      onFilterChange('data_fim', undefined);
    }
  };

  const hasFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== null
  );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="numero_requisicao">Número da Requisição</Label>
            <div className="relative">
              <Input
                id="numero_requisicao"
                placeholder="Buscar por número"
                value={filters.numero_requisicao || ''}
                onChange={(e) => onFilterChange('numero_requisicao', e.target.value)}
                className="pr-8"
              />
              <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="centro_custo">Centro de Custo</Label>
            <Select
              value={filters.centro_custo_id || '_all'}
              onValueChange={(value) => 
                onFilterChange('centro_custo_id', value === '_all' ? undefined : value)
              }
            >
              <SelectTrigger id="centro_custo">
                <SelectValue placeholder="Todos os centros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os centros</SelectItem>
                {centrosCusto.map((centro) => (
                  <SelectItem key={centro.id} value={centro.id}>
                    {centro.nome_centro_custo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Período de Entrega</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-full",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? formatBrazilianDateForDisplay(formatBrazilianDateToString(startDate)) : "Data início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateChange}
                    initialFocus
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-full",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? formatBrazilianDateForDisplay(formatBrazilianDateToString(endDate)) : "Data fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateChange}
                    initialFocus
                    locale={ptBR}
                    disabled={(date) => 
                      startDate ? date < startDate : false
                    }
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onResetFilters}
            disabled={!hasFilters}
          >
            <X className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgramacaoEntregaFilters;
