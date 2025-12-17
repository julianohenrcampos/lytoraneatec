import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
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
const RESULTADOS = [{
  value: 'Crítico',
  label: 'Crítico'
}, {
  value: 'Em Atenção',
  label: 'Em Atenção'
}, {
  value: 'Satisfatório',
  label: 'Satisfatório'
}, {
  value: 'Excelente',
  label: 'Excelente'
}];

const ETAPAS = [{
  value: '1ª Etapa',
  label: '1ª Etapa'
}, {
  value: '2ª Etapa',
  label: '2ª Etapa'
}, {
  value: '3ª Etapa',
  label: '3ª Etapa'
}, {
  value: '4ª Etapa',
  label: '4ª Etapa'
}];
export const SSOChecklistFilters = ({
  onFilterChange,
  onClearFilters
}: SSOChecklistFiltersProps) => {
  const [dataInspecao, setDataInspecao] = useState('');
  const [obraId, setObraId] = useState('');
  const [etapa, setEtapa] = useState('');
  const [resultado, setResultado] = useState('');
  const [tecnico, setTecnico] = useState('');

  const { userRole, isSuperAdmin } = useAuthPermissions();
  
  // Só AdmSSO e SuperAdm podem filtrar por técnico (TecSSO só vê seus próprios checklists)
  const canFilterByTecnico = isSuperAdmin || userRole === 'AdmSSO';

  // Buscar obras
  const {
    data: obras
  } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('bd_centros_custo').select('id, nome_centro_custo').eq('situacao', 'Ativo').order('nome_centro_custo');
      if (error) throw error;
      return data;
    }
  });

  // Preparar opções para o Combobox de obras
  const obraOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Todas as obras' }];
    if (obras) {
      obras.forEach(obra => {
        options.push({
          value: obra.id,
          label: obra.nome_centro_custo
        });
      });
    }
    return options;
  }, [obras]);

  // Buscar técnicos TecSSO (só se pode filtrar)
  const {
    data: tecnicos
  } = useQuery({
    queryKey: ['tecnicos-sso'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('profiles').select('id, nome_completo').contains('funcoes', ['TecSSO']).not('nome_completo', 'is', null).order('nome_completo');
      if (error) throw error;
      return data;
    },
    enabled: canFilterByTecnico
  });
  const handleApplyFilters = () => {
    onFilterChange({
      data_inspecao: dataInspecao || undefined,
      obra_id: obraId && obraId !== 'all' ? obraId : undefined,
      etapa_vistoria: etapa && etapa !== 'all' ? etapa : undefined,
      resultado_avaliacao: resultado && resultado !== 'all' ? resultado : undefined,
      tecnico_seguranca: tecnico && tecnico !== 'all' ? tecnico : undefined
    });
  };
  const handleClear = () => {
    setDataInspecao('');
    setObraId('');
    setEtapa('');
    setResultado('');
    setTecnico('');
    onClearFilters();
  };
  return <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <Label htmlFor="data-inspecao">Data</Label>
          <Input id="data-inspecao" type="date" value={dataInspecao} onChange={e => setDataInspecao(e.target.value)} className="mx-0 px-0" />
        </div>

        <div>
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

        <div>
          <Label htmlFor="etapa">Etapa</Label>
          <Select value={etapa} onValueChange={setEtapa}>
            <SelectTrigger id="etapa">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">Todas as etapas</SelectItem>
              {ETAPAS.map(e => <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="resultado">Resultado</Label>
          <Select value={resultado} onValueChange={setResultado}>
            <SelectTrigger id="resultado">
              <SelectValue placeholder="Todos os resultados" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">Todos os resultados</SelectItem>
              {RESULTADOS.map(r => <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {canFilterByTecnico && (
          <div>
            <Label htmlFor="tecnico">Técnico de Segurança</Label>
            <Select value={tecnico} onValueChange={setTecnico}>
              <SelectTrigger id="tecnico">
                <SelectValue placeholder="Todos os técnicos" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="all">Todos os técnicos</SelectItem>
                {tecnicos?.map(tec => <SelectItem key={tec.id} value={tec.nome_completo || ''}>
                    {tec.nome_completo}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <Button onClick={handleApplyFilters} size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Aplicar Filtros
        </Button>
        <Button onClick={handleClear} variant="outline" size="sm">
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>
    </Card>;
};