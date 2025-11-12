import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X, Database, Cloud } from 'lucide-react';
import type { AbastecimentoFiltros } from '@/types/abastecimento';

interface AbastecimentoFiltersProps {
  onSearch: (filtros: AbastecimentoFiltros, fromCache: boolean) => void;
  isLoading: boolean;
}

export const AbastecimentoFilters = ({ onSearch, isLoading }: AbastecimentoFiltersProps) => {
  const [filtros, setFiltros] = useState<AbastecimentoFiltros>({
    dataInicio: '',
    dataFim: '',
    placa: '',
    frota: '',
    comboista: '',
    combustivel: '',
    cc: ''
  });

  const handleChange = (field: keyof AbastecimentoFiltros, value: string) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const handleSearchAPI = () => {
    onSearch(filtros, false);
  };

  const handleSearchCache = () => {
    onSearch(filtros, true);
  };

  const handleClear = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      placa: '',
      frota: '',
      comboista: '',
      combustivel: '',
      cc: ''
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dataInicio">Data Início</Label>
            <Input
              id="dataInicio"
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => handleChange('dataInicio', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataFim">Data Fim</Label>
            <Input
              id="dataFim"
              type="date"
              value={filtros.dataFim}
              onChange={(e) => handleChange('dataFim', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="placa">Placa</Label>
            <Input
              id="placa"
              type="text"
              placeholder="Ex: ABC1234"
              value={filtros.placa}
              onChange={(e) => handleChange('placa', e.target.value.toUpperCase())}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frota">Frota</Label>
            <Input
              id="frota"
              type="text"
              placeholder="Ex: 001"
              value={filtros.frota}
              onChange={(e) => handleChange('frota', e.target.value.toUpperCase())}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comboista">Comboista</Label>
            <Input
              id="comboista"
              type="text"
              placeholder="Nome do comboista"
              value={filtros.comboista}
              onChange={(e) => handleChange('comboista', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="combustivel">Combustível</Label>
            <Input
              id="combustivel"
              type="text"
              placeholder="Ex: Diesel S10"
              value={filtros.combustivel}
              onChange={(e) => handleChange('combustivel', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">Centro de Custo</Label>
            <Input
              id="cc"
              type="text"
              placeholder="Ex: CC001"
              value={filtros.cc}
              onChange={(e) => handleChange('cc', e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2 flex items-end">
            <Button
              variant="outline"
              onClick={handleClear}
              className="w-full"
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={handleSearchAPI}
            disabled={isLoading || (!filtros.dataInicio && !filtros.dataFim && !filtros.placa && !filtros.frota)}
            className="flex-1"
          >
            <Cloud className="mr-2 h-4 w-4" />
            Buscar na API
          </Button>

          <Button
            onClick={handleSearchCache}
            variant="secondary"
            disabled={isLoading}
            className="flex-1"
          >
            <Database className="mr-2 h-4 w-4" />
            Buscar no Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
