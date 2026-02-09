import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import { VerAgirFilters, STATUS_VER_AGIR, getStatusLabel } from '@/types/ssoVerAgir';

interface VerAgirFiltersComponentProps {
  onFilterChange: (filters: VerAgirFilters) => void;
  onClearFilters: () => void;
}

export const VerAgirFiltersComponent: React.FC<VerAgirFiltersComponentProps> = ({
  onFilterChange,
  onClearFilters
}) => {
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [obra, setObra] = useState('');

  const handleApplyFilters = () => {
    const filters: VerAgirFilters = {};
    
    if (dataInicio) filters.data_inicio = dataInicio;
    if (dataFim) filters.data_fim = dataFim;
    if (status !== 'all') filters.status = status as VerAgirFilters['status'];
    if (obra) filters.obra = obra;
    
    onFilterChange(filters);
  };

  const handleClear = () => {
    setDataInicio('');
    setDataFim('');
    setStatus('all');
    setObra('');
    onClearFilters();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data Início */}
          <div className="space-y-2">
            <Label htmlFor="dataInicio">Data Início</Label>
            <Input
              id="dataInicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          {/* Data Fim */}
          <div className="space-y-2">
            <Label htmlFor="dataFim">Data Fim</Label>
            <Input
              id="dataFim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUS_VER_AGIR.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Obra */}
          <div className="space-y-2">
            <Label htmlFor="obra">Obra</Label>
            <Input
              id="obra"
              placeholder="Buscar por obra..."
              value={obra}
              onChange={(e) => setObra(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleClear}>
            <X className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleApplyFilters}>
            <Search className="h-4 w-4 mr-2" />
            Aplicar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
