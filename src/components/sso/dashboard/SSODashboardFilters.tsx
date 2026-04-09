import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardFilters } from '@/hooks/sso/useSSODashboard';
import { usePermission } from '@/hooks/usePermission';

const RESULTADOS = [
  { value: 'Excelente', label: 'Excelente' },
  { value: 'Satisfatório', label: 'Satisfatório' },
  { value: 'Em Atenção', label: 'Em Atenção' },
  { value: 'Crítico', label: 'Crítico' },
];

interface SSODashboardFiltersProps {
  filters: DashboardFilters;
  onFilterChange: (filters: DashboardFilters) => void;
}

export const SSODashboardFilters = ({ filters, onFilterChange }: SSODashboardFiltersProps) => {
  const [dataInspecao, setDataInspecao] = useState(filters.data_inspecao || '');
  const [obraId, setObraId] = useState(filters.obra_id || '');
  const [resultado, setResultado] = useState(filters.resultado_avaliacao || '');
  const [tecnico, setTecnico] = useState(filters.tecnico_seguranca || '');

  const { userRole, isSuperAdmin } = usePermission();
  
  // Só AdmSSO e SuperAdm podem filtrar por técnico (TecSSO só vê seus próprios checklists)
  const canFilterByTecnico = isSuperAdmin || userRole === 'AdmSSO' || userRole === 'AdmOBRA';

  const { data: obras } = useQuery({
    queryKey: ['obras-ativas', isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo');
      if (!isSuperAdmin) query = query.neq('codigo_centro_custo', 'DIR001');
      const { data, error } = await query.order('nome_centro_custo');
      if (error) throw error;
      return data;
    }
  });

  // Buscar técnicos TecSSO (só se pode filtrar)
  const { data: tecnicos } = useQuery({
    queryKey: ['tecnicos-sso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome_completo')
        .contains('funcoes', ['TecSSO'])
        .not('nome_completo', 'is', null)
        .order('nome_completo');
      
      if (error) throw error;
      return data;
    },
    enabled: canFilterByTecnico
  });

  const handleApplyFilters = () => {
    onFilterChange({
      data_inspecao: dataInspecao || undefined,
      obra_id: obraId || undefined,
      resultado_avaliacao: resultado || undefined,
      tecnico_seguranca: tecnico || undefined,
    });
  };

  const handleClear = () => {
    setDataInspecao('');
    setObraId('');
    setResultado('');
    setTecnico('');
    onFilterChange({});
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Filtros</h3>
      </div>

      <div className="flex flex-wrap lg:flex-nowrap items-end gap-3">
        <div className="w-full sm:w-[130px]">
          <Label htmlFor="data-inspecao" className="text-xs">Data</Label>
          <Input
            id="data-inspecao"
            type="date"
            value={dataInspecao}
            onChange={(e) => setDataInspecao(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="w-full sm:flex-1 sm:min-w-[160px]">
          <Label htmlFor="obra" className="text-xs">Obra</Label>
          <Select
            value={obraId || 'all'}
            onValueChange={(value) => setObraId(value === 'all' ? '' : value)}
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

        <div className="w-full sm:w-[150px]">
          <Label htmlFor="resultado" className="text-xs">Resultado</Label>
          <Select
            value={resultado || 'all'}
            onValueChange={(value) => setResultado(value === 'all' ? '' : value)}
          >
            <SelectTrigger id="resultado" className="mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {RESULTADOS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canFilterByTecnico && (
          <div className="w-full sm:flex-1 sm:min-w-[160px]">
            <Label htmlFor="tecnico" className="text-xs">Técnico de Segurança</Label>
            <Select
              value={tecnico || 'all'}
              onValueChange={(value) => setTecnico(value === 'all' ? '' : value)}
            >
              <SelectTrigger id="tecnico" className="mt-1">
                <SelectValue placeholder="Todos os técnicos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os técnicos</SelectItem>
                {tecnicos?.map((tec) => (
                  <SelectItem key={tec.id} value={tec.nome_completo || ''}>
                    {tec.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 w-full lg:w-auto">
          <Button onClick={handleApplyFilters} size="sm" className="gap-1.5">
            <Filter className="h-4 w-4" />
            Aplicar
          </Button>
          <Button onClick={handleClear} variant="outline" size="sm" className="gap-1.5">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>
    </Card>
  );
};
