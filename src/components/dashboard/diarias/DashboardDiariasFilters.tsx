import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

// Diárias seguem semana operacional: segunda → domingo (corte no domingo)
const toMonday = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
const toSunday = (d: Date) => endOfWeek(d, { weekStartsOn: 1 });
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Combobox } from "@/components/ui/combobox";
import { usePermission } from "@/hooks/usePermission";

export type PeriodFilter = "today" | "week" | "month" | "quarter" | "year" | "custom";

export interface DiariasFilters {
  periodo: PeriodFilter;
  dataInicio?: Date;
  dataFim?: Date;
  centroCustoId?: string;
  solicitacaoId?: string;
  gerenteRegionalId?: string;
  engenheiroSolicitanteId?: string;
  funcionarioId?: string;
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
  const { isSuperAdmin } = usePermission();
  // Centros de custo
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-diarias-dashboard', isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .eq('situacao', 'Ativo');
      if (!isSuperAdmin) query = query.neq('codigo_centro_custo', 'DIR001');
      const { data, error } = await query.order('codigo_centro_custo');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Nº Solicitações
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-diarias-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('id, numero_solicitacao')
        .order('numero_solicitacao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000
  });

  // Gerentes Regionais (aprovadores de centros de custo)
  const { data: gerentesRegionais = [] } = useQuery({
    queryKey: ['gerentes-regionais-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('aprovador_diarias_id, bd_funcionarios!bd_centros_custo_aprovador_diarias_id_fkey(id, nome_completo)')
        .not('aprovador_diarias_id', 'is', null)
        .eq('situacao', 'Ativo');
      if (error) throw error;
      
      const uniqueMap = new Map<string, string>();
      (data || []).forEach((cc: any) => {
        const func = cc.bd_funcionarios;
        if (func?.id && func?.nome_completo) {
          uniqueMap.set(func.id, func.nome_completo);
        }
      });
      return Array.from(uniqueMap.entries()).map(([id, nome]) => ({ id, nome_completo: nome }));
    },
    staleTime: 5 * 60 * 1000
  });

  // Engenheiros Solicitantes
  const { data: engenheiros = [] } = useQuery({
    queryKey: ['engenheiros-solicitantes-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_diaria_solicitacoes')
        .select('engenheiro_solicitante_id, bd_funcionarios!bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey(id, nome_completo)')
        .not('engenheiro_solicitante_id', 'is', null);
      if (error) throw error;
      
      const uniqueMap = new Map<string, string>();
      (data || []).forEach((sol: any) => {
        const func = sol.bd_funcionarios;
        if (func?.id && func?.nome_completo) {
          uniqueMap.set(func.id, func.nome_completo);
        }
      });
      return Array.from(uniqueMap.entries()).map(([id, nome]) => ({ id, nome_completo: nome }));
    },
    staleTime: 5 * 60 * 1000
  });

  // Funcionários presentes nos apontamentos
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-presentes-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_relatorio_diarias_folha')
        .select('funcionario_id, nome_funcionario');
      if (error) throw error;
      
      const uniqueMap = new Map<string, string>();
      (data || []).forEach((p: any) => {
        if (p.funcionario_id && p.nome_funcionario) {
          uniqueMap.set(p.funcionario_id, p.nome_funcionario);
        }
      });
      return Array.from(uniqueMap.entries())
        .map(([id, nome]) => ({ id, nome_completo: nome }))
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    },
    staleTime: 5 * 60 * 1000
  });

  const handlePeriodChange = (periodo: PeriodFilter) => {
    const now = new Date();
    let dataInicio: Date | undefined;
    let dataFim: Date | undefined;

    switch (periodo) {
      case "today": {
        // "Hoje" → semana operacional atual (seg→dom)
        dataInicio = toMonday(now);
        dataFim = toSunday(now);
        break;
      }
      case "week":
        dataInicio = toMonday(now);
        dataFim = toSunday(now);
        break;
      case "month":
        // Mês ajustado às bordas semanais (seg da semana do dia 1 → dom da semana do último dia)
        dataInicio = toMonday(startOfMonth(now));
        dataFim = toSunday(endOfMonth(now));
        break;
      case "quarter":
        dataInicio = toMonday(startOfQuarter(now));
        dataFim = toSunday(endOfQuarter(now));
        break;
      case "year":
        dataInicio = toMonday(startOfYear(now));
        dataFim = toSunday(endOfYear(now));
        break;
      case "custom":
        dataInicio = filters.dataInicio ? toMonday(filters.dataInicio) : undefined;
        dataFim = filters.dataFim ? toSunday(filters.dataFim) : undefined;
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

  const ccOptions = centrosCusto.map(cc => ({
    value: cc.id,
    label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
  }));

  const solicitacaoOptions = solicitacoes.map(s => ({
    value: s.id,
    label: s.numero_solicitacao
  }));

  const gerenteOptions = gerentesRegionais.map(g => ({
    value: g.id,
    label: g.nome_completo
  }));

  const engenheiroOptions = engenheiros.map(e => ({
    value: e.id,
    label: e.nome_completo
  }));

  const funcionarioOptions = funcionarios.map(f => ({
    value: f.id,
    label: f.nome_completo
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Filtros</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data Início */}
          <div className="space-y-1.5">
            <Label className="text-xs">Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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
                  onSelect={(date) => onFilterChange({ periodo: "custom", dataInicio: date ? toMonday(date) : undefined })}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-[10px] text-muted-foreground">Ajustado para a segunda-feira da semana</p>
          </div>

          {/* Data Fim */}
          <div className="space-y-1.5">
            <Label className="text-xs">Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
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
                  onSelect={(date) => onFilterChange({ periodo: "custom", dataFim: date ? toSunday(date) : undefined })}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-[10px] text-muted-foreground">Ajustado para o domingo da semana (corte)</p>
          </div>

          {/* Nº Solicitação */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nº Solicitação</Label>
            <Combobox
              options={solicitacaoOptions}
              value={filters.solicitacaoId || ""}
              onChange={(value) => onFilterChange({ solicitacaoId: value || undefined })}
              placeholder="Todas"
              searchPlaceholder="Buscar solicitação..."
              emptyText="Nenhuma solicitação encontrada"
            />
          </div>

          {/* Centro de Custo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Centro de Custo</Label>
            <Combobox
              options={ccOptions}
              value={filters.centroCustoId || ""}
              onChange={(value) => onFilterChange({ centroCustoId: value || undefined })}
              placeholder="Todos"
              searchPlaceholder="Buscar centro de custo..."
              emptyText="Nenhum centro de custo encontrado"
            />
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Funcionário */}
          <div className="space-y-1.5">
            <Label className="text-xs">Funcionário</Label>
            <Combobox
              options={funcionarioOptions}
              value={filters.funcionarioId || ""}
              onChange={(value) => onFilterChange({ funcionarioId: value || undefined })}
              placeholder="Todos"
              searchPlaceholder="Buscar funcionário..."
              emptyText="Nenhum funcionário encontrado"
            />
          </div>

          {/* Engenheiro Solicitante */}
          <div className="space-y-1.5">
            <Label className="text-xs">Engenheiro Solicitante</Label>
            <Combobox
              options={engenheiroOptions}
              value={filters.engenheiroSolicitanteId || ""}
              onChange={(value) => onFilterChange({ engenheiroSolicitanteId: value || undefined })}
              placeholder="Todos"
              searchPlaceholder="Buscar engenheiro..."
              emptyText="Nenhum engenheiro encontrado"
            />
          </div>

          {/* Gerente Regional */}
          <div className="space-y-1.5">
            <Label className="text-xs">Gerente Regional</Label>
            <Combobox
              options={gerenteOptions}
              value={filters.gerenteRegionalId || ""}
              onChange={(value) => onFilterChange({ gerenteRegionalId: value || undefined })}
              placeholder="Todos"
              searchPlaceholder="Buscar gerente..."
              emptyText="Nenhum gerente encontrado"
            />
          </div>

          {/* Período */}
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <Select 
              value={filters.periodo} 
              onValueChange={(value: PeriodFilter) => handlePeriodChange(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Limpar Filtros */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
