import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SSOChecklistFiltersProps {
  onFilterChange: (filters: {
    data_inspecao?: string;
    obra_id?: string;
    resultado_avaliacao?: string;
  }) => void;
  onClearFilters: () => void;
}

const RESULTADOS = [
  { value: 'Crítico', label: 'Crítico' },
  { value: 'Em Atenção', label: 'Em Atenção' },
  { value: 'Satisfatório', label: 'Satisfatório' },
  { value: 'Excelente', label: 'Excelente' },
];

export const SSOChecklistFilters = ({ onFilterChange, onClearFilters }: SSOChecklistFiltersProps) => {
  const [dataInspecao, setDataInspecao] = useState('');
  const [obraId, setObraId] = useState('');
  const [resultado, setResultado] = useState('');

  // Buscar obras
  const { data: obras } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      
      if (error) throw error;
      return data;
    }
  });

  const handleApplyFilters = () => {
    onFilterChange({
      data_inspecao: dataInspecao || undefined,
      obra_id: obraId && obraId !== 'all' ? obraId : undefined,
      resultado_avaliacao: resultado && resultado !== 'all' ? resultado : undefined,
    });
  };

  const handleClear = () => {
    setDataInspecao('');
    setObraId('');
    setResultado('');
    onClearFilters();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="data-inspecao">Data</Label>
          <Input
            id="data-inspecao"
            type="date"
            value={dataInspecao}
            onChange={(e) => setDataInspecao(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="obra">Obra</Label>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger id="obra">
              <SelectValue placeholder="Todas as obras" />
            </SelectTrigger>
            <SelectContent className="bg-background">
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
          <Label htmlFor="resultado">Resultado</Label>
          <Select value={resultado} onValueChange={setResultado}>
            <SelectTrigger id="resultado">
              <SelectValue placeholder="Todos os resultados" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">Todos os resultados</SelectItem>
              {RESULTADOS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
    </Card>
  );
};
