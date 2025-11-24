import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardFilters } from '@/hooks/sso/useSSODashboard';

interface SSODashboardFiltersProps {
  filters: DashboardFilters;
  onFilterChange: (filters: DashboardFilters) => void;
}

export const SSODashboardFilters = ({ filters, onFilterChange }: SSODashboardFiltersProps) => {
  const { data: obras } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');

      if (error) throw error;
      return data;
    }
  });

  const handleClearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="data-inicio" className="text-xs">Data Início</Label>
          <Input
            id="data-inicio"
            type="date"
            value={filters.data_inicio || ''}
            onChange={(e) => onFilterChange({ ...filters, data_inicio: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="data-fim" className="text-xs">Data Fim</Label>
          <Input
            id="data-fim"
            type="date"
            value={filters.data_fim || ''}
            onChange={(e) => onFilterChange({ ...filters, data_fim: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="obra" className="text-xs">Obra</Label>
          <Select
            value={filters.obra_id || 'all'}
            onValueChange={(value) => 
              onFilterChange({ ...filters, obra_id: value === 'all' ? undefined : value })
            }
          >
            <SelectTrigger id="obra" className="mt-1">
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {obras?.map((obra) => (
                <SelectItem key={obra.id} value={obra.id}>
                  {obra.nome_centro_custo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="resultado" className="text-xs">Resultado</Label>
          <Select
            value={filters.resultado_avaliacao || 'all'}
            onValueChange={(value) => 
              onFilterChange({ ...filters, resultado_avaliacao: value === 'all' ? undefined : value })
            }
          >
            <SelectTrigger id="resultado" className="mt-1">
              <SelectValue placeholder="Todos os resultados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os resultados</SelectItem>
              <SelectItem value="Excelente">Excelente</SelectItem>
              <SelectItem value="Satisfatório">Satisfatório</SelectItem>
              <SelectItem value="Em Atenção">Em Atenção</SelectItem>
              <SelectItem value="Crítico">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
};
