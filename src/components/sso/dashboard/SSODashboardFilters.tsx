import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
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

  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canFilterByTecnico = isSuperAdmin || hasActionPermission('acesso_sso_dashboard', 'editar');

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

  // Auto-apply filters
  useEffect(() => {
    onFilterChange({
      data_inspecao: dataInspecao || undefined,
      obra_id: obraId || undefined,
      resultado_avaliacao: resultado || undefined,
      tecnico_seguranca: tecnico || undefined,
    });
  }, [dataInspecao, obraId, resultado, tecnico]);

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
            <Label htmlFor="data-inspecao">Data</Label>
            <Input
              id="data-inspecao"
              type="date"
              value={dataInspecao}
              onChange={(e) => setDataInspecao(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obra">Obra</Label>
            <Select
              value={obraId || 'all'}
              onValueChange={(value) => setObraId(value === 'all' ? '' : value)}
            >
              <SelectTrigger id="obra">
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

          <div className="space-y-1.5">
            <Label htmlFor="resultado">Resultado</Label>
            <Select
              value={resultado || 'all'}
              onValueChange={(value) => setResultado(value === 'all' ? '' : value)}
            >
              <SelectTrigger id="resultado">
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
            <div className="space-y-1.5">
              <Label htmlFor="tecnico">Técnico de Segurança</Label>
              <Select
                value={tecnico || 'all'}
                onValueChange={(value) => setTecnico(value === 'all' ? '' : value)}
              >
                <SelectTrigger id="tecnico">
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
        </div>
      </CardContent>
    </Card>
  );
};
