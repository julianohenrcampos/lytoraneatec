import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PeriodFilter = "today" | "week" | "month" | "quarter" | "year" | "custom";

export interface DiariasFilters {
  periodo: PeriodFilter;
  dataInicio?: Date;
  dataFim?: Date;
  centroCustoId?: string;
  status?: 'rascunho' | 'enviada' | 'autorizada' | 'reprovada';
}

interface DashboardDiariasFiltersProps {
  filters: DiariasFilters;
  onFilterChange: (filters: Partial<DiariasFilters>) => void;
  onClearFilters: () => void;
}

export default function DashboardDiariasFilters({ 
  filters, 
  onFilterChange, 
  onClearFilters 
}: DashboardDiariasFiltersProps) {
  // Carregar centros de custo
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-diarias-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('codigo_centro_custo');
      if (error) throw error;
      return data || [];
    }
  });

  const handlePeriodChange = (periodo: PeriodFilter) => {
    const now = new Date();
    let dataInicio: Date | undefined;
    let dataFim: Date | undefined;

    switch (periodo) {
      case "today":
        dataInicio = startOfDay(now);
        dataFim = endOfDay(now);
        break;
      case "week":
        dataInicio = startOfWeek(now, { locale: ptBR });
        dataFim = endOfWeek(now, { locale: ptBR });
        break;
      case "month":
        dataInicio = startOfMonth(now);
        dataFim = endOfMonth(now);
        break;
      case "quarter":
        dataInicio = startOfQuarter(now);
        dataFim = endOfQuarter(now);
        break;
      case "year":
        dataInicio = startOfYear(now);
        dataFim = endOfYear(now);
        break;
      case "custom":
        // Mantém as datas atuais quando muda para custom
        dataInicio = filters.dataInicio;
        dataFim = filters.dataFim;
        break;
    }

    onFilterChange({ periodo, dataInicio, dataFim });
  };

  const periodLabels: Record<PeriodFilter, string> = {
    today: "Hoje",
    week: "Esta Semana",
    month: "Este Mês",
    quarter: "Este Trimestre",
    year: "Este Ano",
    custom: "Personalizado"
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Período */}
          <div className="space-y-2">
            <Label>Período</Label>
            <Select 
              value={filters.periodo} 
              onValueChange={(value: PeriodFilter) => handlePeriodChange(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Início */}
          <div className="space-y-2">
            <Label>Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[150px] justify-start text-left font-normal",
                    !filters.dataInicio && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataInicio ? format(filters.dataInicio, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dataInicio}
                  onSelect={(date) => {
                    onFilterChange({ periodo: "custom", dataInicio: date });
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Data Fim */}
          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[150px] justify-start text-left font-normal",
                    !filters.dataFim && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataFim ? format(filters.dataFim, "dd/MM/yyyy") : "Selecione"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dataFim}
                  onSelect={(date) => {
                    onFilterChange({ periodo: "custom", dataFim: date });
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Centro de Custo */}
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select 
              value={filters.centroCustoId || "all"} 
              onValueChange={(value) => onFilterChange({ centroCustoId: value === "all" ? undefined : value })}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {centrosCusto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.codigo_centro_custo} - {cc.nome_centro_custo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={filters.status || "all"} 
              onValueChange={(value) => onFilterChange({ 
                status: value === "all" ? undefined : value as DiariasFilters['status']
              })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="autorizada">Autorizada</SelectItem>
                <SelectItem value="reprovada">Reprovada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limpar Filtros */}
          <Button variant="ghost" size="icon" onClick={onClearFilters}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
