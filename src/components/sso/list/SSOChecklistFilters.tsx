import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';

interface SSOChecklistFiltersProps {
  onFilterChange: (filters: {
    data_inspecao?: string;
    obra_id?: string;
    etapa_vistoria?: string;
    resultado_avaliacao?: string;
    tecnico_seguranca?: string;
  }) => void;
  onClearFilters: () => void;
}

const RESULTADOS = [
  { value: 'Crítico', label: 'Crítico' },
  { value: 'Em Atenção', label: 'Em Atenção' },
  { value: 'Satisfatório', label: 'Satisfatório' },
  { value: 'Excelente', label: 'Excelente' },
];

const ETAPAS = [
  { value: '1ª Etapa', label: '1ª Etapa' },
  { value: '2ª Etapa', label: '2ª Etapa' },
  { value: '3ª Etapa', label: '3ª Etapa' },
  { value: '4ª Etapa', label: '4ª Etapa' },
];

export const SSOChecklistFilters = ({
  onFilterChange,
  onClearFilters
}: SSOChecklistFiltersProps) => {
  const [dataInspecao, setDataInspecao] = useState('');
  const [obraId, setObraId] = useState('');
  const [etapa, setEtapa] = useState('');
  const [resultado, setResultado] = useState('');
  const [tecnico, setTecnico] = useState('');

  const { userRole, isSuperAdmin } = usePermission();
  const canFilterByTecnico = isSuperAdmin || userRole === 'AdmSSO';

  const { data: obras } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bd_centros_custo').select('id, nome_centro_custo').eq('situacao', 'Ativo').order('nome_centro_custo');
      if (error) throw error;
      return data;
    }
  });

  const obraOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Todas as obras' }];
    if (obras) {
      obras.forEach(obra => {
        options.push({ value: obra.id, label: obra.nome_centro_custo });
      });
    }
    return options;
  }, [obras]);

  const { data: tecnicos } = useQuery({
    queryKey: ['tecnicos-sso'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, nome_completo').contains('funcoes', ['TecSSO']).not('nome_completo', 'is', null).order('nome_completo');
      if (error) throw error;
      return data;
    },
    enabled: canFilterByTecnico
  });

  // Auto-apply filters
  useEffect(() => {
    onFilterChange({
      data_inspecao: dataInspecao || undefined,
      obra_id: obraId && obraId !== 'all' ? obraId : undefined,
      etapa_vistoria: etapa && etapa !== 'all' ? etapa : undefined,
      resultado_avaliacao: resultado && resultado !== 'all' ? resultado : undefined,
      tecnico_seguranca: tecnico && tecnico !== 'all' ? tecnico : undefined
    });
  }, [dataInspecao, obraId, etapa, resultado, tecnico]);

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
            <Input id="data-inspecao" type="date" value={dataInspecao} onChange={e => setDataInspecao(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Obra</Label>
            <Combobox
              options={obraOptions}
              value={obraId || 'all'}
              onChange={(value) => setObraId(value === 'all' ? '' : value)}
              placeholder="Todas as obras"
              searchPlaceholder="Buscar obra..."
              emptyText="Nenhuma obra encontrada"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etapa">Etapa</Label>
            <Select value={etapa} onValueChange={setEtapa}>
              <SelectTrigger id="etapa">
                <SelectValue placeholder="Todas as etapas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etapas</SelectItem>
                {ETAPAS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resultado">Resultado</Label>
            <Select value={resultado} onValueChange={setResultado}>
              <SelectTrigger id="resultado">
                <SelectValue placeholder="Todos os resultados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os resultados</SelectItem>
                {RESULTADOS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {canFilterByTecnico && (
            <div className="space-y-1.5">
              <Label htmlFor="tecnico">Técnico de Segurança</Label>
              <Select value={tecnico} onValueChange={setTecnico}>
                <SelectTrigger id="tecnico">
                  <SelectValue placeholder="Todos os técnicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os técnicos</SelectItem>
                  {tecnicos?.map(tec => <SelectItem key={tec.id} value={tec.nome_completo || ''}>{tec.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
