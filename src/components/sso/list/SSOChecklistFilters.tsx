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
    data_inicio?: string;
    data_fim?: string;
    obra_id?: string;
    criado_por?: string;
  }) => void;
  onClearFilters: () => void;
}

export const SSOChecklistFilters = ({ onFilterChange, onClearFilters }: SSOChecklistFiltersProps) => {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [obraId, setObraId] = useState('');
  const [criadoPor, setCriadoPor] = useState('');

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

  // Buscar usuários (responsáveis)
  const { data: usuarios } = useQuery({
    queryKey: ['profiles-sso'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome_completo')
        .order('nome_completo');
      
      if (error) throw error;
      return data;
    }
  });

  const handleApplyFilters = () => {
    onFilterChange({
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      obra_id: obraId || undefined,
      criado_por: criadoPor || undefined,
    });
  };

  const handleClear = () => {
    setDataInicio('');
    setDataFim('');
    setObraId('');
    setCriadoPor('');
    onClearFilters();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Filtros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="data-inicio">Data Início</Label>
          <Input
            id="data-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="data-fim">Data Fim</Label>
          <Input
            id="data-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
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
          <Label htmlFor="responsavel">Responsável</Label>
          <Select value={criadoPor} onValueChange={setCriadoPor}>
            <SelectTrigger id="responsavel">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="all">Todos</SelectItem>
              {usuarios?.map((usuario) => (
                <SelectItem key={usuario.id} value={usuario.id}>
                  {usuario.nome_completo}
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
