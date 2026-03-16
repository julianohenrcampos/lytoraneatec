import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { SSODesvioFilters, STATUS_ACAO, CLASSIFICACAO_DESVIO, TIPOS_DESVIO } from '@/types/ssoDesvios';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Filter, X } from 'lucide-react';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';
import { RESTRICTED_CC_CODE } from '@/utils/centroCustoRestrictions';

interface SSODesvioFiltersProps {
  onFilterChange: (filters: SSODesvioFilters) => void;
  onClearFilters: () => void;
}

export const SSODesvioFiltersComponent: React.FC<SSODesvioFiltersProps> = ({
  onFilterChange,
  onClearFilters
}) => {
  const [dataRegistro, setDataRegistro] = useState('');
  const [obraId, setObraId] = useState('');
  const [tipoDesvio, setTipoDesvio] = useState('');
  const [tecnicoSeguranca, setTecnicoSeguranca] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [statusAcao, setStatusAcao] = useState('');
  const { isSuperAdmin } = useDynamicPermissions();

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas', isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo');
      if (!isSuperAdmin) query = query.neq('codigo_centro_custo', RESTRICTED_CC_CODE);
      const { data, error } = await query.order('nome_centro_custo');
      if (error) throw error;
      return data || [];
    }
  });

  const obraOptions = React.useMemo(() => [
    { value: 'all', label: 'Todas as obras' },
    ...obras.map(obra => ({
      value: obra.id,
      label: `${obra.codigo_centro_custo} - ${obra.nome_centro_custo}`
    }))
  ], [obras]);

  const handleApplyFilters = () => {
    const filters: SSODesvioFilters = {};
    
    if (dataRegistro) filters.data_registro = dataRegistro;
    if (obraId && obraId !== 'all') filters.obra_id = obraId;
    if (tipoDesvio && tipoDesvio !== 'all') filters.tipo_desvio = tipoDesvio;
    if (tecnicoSeguranca) filters.tecnico_seguranca = tecnicoSeguranca;
    if (classificacao && classificacao !== 'all') filters.classificacao_desvio = classificacao as any;
    if (statusAcao && statusAcao !== 'all') filters.status_acao = statusAcao as any;
    
    onFilterChange(filters);
  };

  const handleClear = () => {
    setDataRegistro('');
    setObraId('');
    setTipoDesvio('');
    setTecnicoSeguranca('');
    setClassificacao('');
    setStatusAcao('');
    onClearFilters();
  };

  return (
    <Card className="p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Data */}
        <div className="space-y-2">
          <Label htmlFor="data-registro">Data do Registro</Label>
          <Input
            id="data-registro"
            type="date"
            value={dataRegistro}
            onChange={(e) => setDataRegistro(e.target.value)}
          />
        </div>

        {/* Obra */}
        <div className="space-y-2">
          <Label>Obra</Label>
          <Combobox
            options={obraOptions}
            value={obraId}
            onChange={setObraId}
            placeholder="Selecione a obra"
            searchPlaceholder="Buscar obra..."
            emptyText="Nenhuma obra encontrada"
          />
        </div>

        {/* Tipo de Desvio */}
        <div className="space-y-2">
          <Label>Tipo de Desvio</Label>
          <Select value={tipoDesvio} onValueChange={setTipoDesvio}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS_DESVIO.map(tipo => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Técnico de Segurança */}
        <div className="space-y-2">
          <Label htmlFor="tecnico">Técnico de Segurança</Label>
          <Input
            id="tecnico"
            placeholder="Nome do técnico"
            value={tecnicoSeguranca}
            onChange={(e) => setTecnicoSeguranca(e.target.value)}
          />
        </div>

        {/* Classificação */}
        <div className="space-y-2">
          <Label>Classificação</Label>
          <Select value={classificacao} onValueChange={setClassificacao}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CLASSIFICACAO_DESVIO.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label>Status da Ação</Label>
          <Select value={statusAcao} onValueChange={setStatusAcao}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS_ACAO.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2 mt-4 justify-end">
        <Button variant="outline" onClick={handleClear}>
          <X className="h-4 w-4 mr-2" />
          Limpar
        </Button>
        <Button onClick={handleApplyFilters}>
          <Filter className="h-4 w-4 mr-2" />
          Aplicar Filtros
        </Button>
      </div>
    </Card>
  );
};
