import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { SSODesvioFilters, STATUS_ACAO, CLASSIFICACAO_DESVIO, TIPOS_DESVIO } from '@/types/ssoDesvios';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Filter } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
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
  const { isSuperAdmin } = usePermission();

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

  // Auto-apply filters
  useEffect(() => {
    const filters: SSODesvioFilters = {};
    if (dataRegistro) filters.data_registro = dataRegistro;
    if (obraId && obraId !== 'all') filters.obra_id = obraId;
    if (tipoDesvio && tipoDesvio !== 'all') filters.tipo_desvio = tipoDesvio;
    if (tecnicoSeguranca) filters.tecnico_seguranca = tecnicoSeguranca;
    if (classificacao && classificacao !== 'all') filters.classificacao_desvio = classificacao as any;
    if (statusAcao && statusAcao !== 'all') filters.status_acao = statusAcao as any;
    onFilterChange(filters);
  }, [dataRegistro, obraId, tipoDesvio, tecnicoSeguranca, classificacao, statusAcao]);

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
            <Label htmlFor="data-registro">Data do Registro</Label>
            <Input
              id="data-registro"
              type="date"
              value={dataRegistro}
              onChange={(e) => setDataRegistro(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
            <Label htmlFor="tecnico">Técnico de Segurança</Label>
            <Input
              id="tecnico"
              placeholder="Nome do técnico"
              value={tecnicoSeguranca}
              onChange={(e) => setTecnicoSeguranca(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
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
      </CardContent>
    </Card>
  );
};
