
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RequisicaoFilters as RequisicaoFiltersType } from "@/types/requisicao";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermission } from "@/hooks/usePermission";
import { RESTRICTED_CC_CODE } from "@/utils/centroCustoRestrictions";

interface RequisicaoFiltersProps {
  filters: RequisicaoFiltersType;
  onFilterChange: (name: keyof RequisicaoFiltersType, value: any) => void;
  onResetFilters: () => void;
}

const RequisicaoFilters: React.FC<RequisicaoFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters
}) => {
  const isMobile = useIsMobile();
  const { isSuperAdmin } = usePermission();
  
  const {
    data: centrosCusto = []
  } = useQuery({
    queryKey: ['centros-custo', isSuperAdmin],
    queryFn: async () => {
      let query = supabase.from('bd_centros_custo').select('id, nome_centro_custo');
      if (!isSuperAdmin) query = query.neq('codigo_centro_custo', RESTRICTED_CC_CODE);
      const { data, error } = await query.order('nome_centro_custo');
      if (error) throw error;
      return data;
    }
  });

  const {
    data: engenheiros = []
  } = useQuery({
    queryKey: ['engenheiros'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bd_funcionarios').select('id, nome_completo').order('nome_completo');
      if (error) throw error;
      return data;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="numero">Número da Requisição</Label>
            <Input id="numero" placeholder="Buscar por número" value={filters.numero || ""} onChange={e => onFilterChange("numero", e.target.value)} />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="centro_custo">Centro de Custo</Label>
            <Select value={filters.centro_custo_id || ""} onValueChange={value => onFilterChange("centro_custo_id", value)}>
              <SelectTrigger id="centro_custo">
                <SelectValue placeholder="Selecione um centro de custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {centrosCusto.map(centro => <SelectItem key={centro.id} value={centro.id}>
                    {centro.nome_centro_custo}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="engenheiro">Engenheiro Responsável</Label>
            <Select value={filters.engenheiro_id || ""} onValueChange={value => onFilterChange("engenheiro_id", value)}>
              <SelectTrigger id="engenheiro">
                <SelectValue placeholder="Selecione um engenheiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos</SelectItem>
                {engenheiros.map(eng => <SelectItem key={eng.id} value={eng.id}>
                    {eng.nome_completo}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label>Data Inicial</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !filters.data_inicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.data_inicio ? format(filters.data_inicio, "PP", {
                  locale: ptBR
                }) : <span>Selecione</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={filters.data_inicio || undefined} onSelect={date => onFilterChange("data_inicio", date)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RequisicaoFilters;
