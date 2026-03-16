import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgendamentoExameFilters, TIPOS_EXAME, STATUS_AGENDAMENTO, STATUS_INTEGRACAO, STATUS_CARTEIRA } from '@/types/ssoAgendamentoExames';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AgendamentoExamesFiltersProps {
  onFilterChange: (filters: AgendamentoExameFilters) => void;
  onClearFilters: () => void;
}

export const AgendamentoExamesFilters: React.FC<AgendamentoExamesFiltersProps> = ({
  onFilterChange,
  onClearFilters
}) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);
  
  // Estados dos filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [funcao, setFuncao] = useState('');
  const [status, setStatus] = useState('');
  const [tipoExame, setTipoExame] = useState('');
  const [localAtendimentoId, setLocalAtendimentoId] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [contrato, setContrato] = useState('');
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [cpf, setCpf] = useState('');
  const [statusIntegracao, setStatusIntegracao] = useState('');
  const [statusCarteira, setStatusCarteira] = useState('');

  const { locais, empresas, funcoes, centrosCusto } = useAgendamentoExames();

  const empresasOptions = useMemo(() => [
    { value: '', label: 'Todas as empresas' },
    ...empresas.map(e => ({ value: e.nome_empresa, label: e.nome_empresa }))
  ], [empresas]);

  const centrosCustoOptions = useMemo(() => [
    { value: '', label: 'Todos os centros de custo' },
    ...centrosCusto.map(cc => ({
      value: cc.nome_centro_custo,
      label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
    }))
  ], [centrosCusto]);

  const funcoesOptions = useMemo(() => [
    { value: '', label: 'Todas as funções' },
    ...funcoes.map(f => ({ value: f.nome_funcao, label: f.nome_funcao }))
  ], [funcoes]);

  const handleApplyFilters = () => {
    const filters: AgendamentoExameFilters = {};
    
    if (dataInicio) filters.data_inicio = dataInicio;
    if (dataFim) filters.data_fim = dataFim;
    if (funcao) filters.funcao = funcao;
    if (status && status !== 'all') filters.status = status;
    if (tipoExame && tipoExame !== 'all') filters.tipo_exame = tipoExame;
    if (localAtendimentoId && localAtendimentoId !== 'all') filters.local_atendimento_id = localAtendimentoId;
    if (empresa) filters.empresa = empresa;
    if (contrato) filters.contrato = contrato;
    if (nomeColaborador) filters.nome_colaborador = nomeColaborador;
    if (cpf) filters.cpf = cpf;
    if (statusIntegracao && statusIntegracao !== 'all') filters.status_integracao = statusIntegracao;
    if (statusCarteira && statusCarteira !== 'all') filters.status_carteira = statusCarteira;
    
    onFilterChange(filters);
  };

  const handleClear = () => {
    setDataInicio('');
    setDataFim('');
    setFuncao('');
    setStatus('');
    setTipoExame('');
    setLocalAtendimentoId('');
    setEmpresa('');
    setContrato('');
    setNomeColaborador('');
    setCpf('');
    setStatusIntegracao('');
    setStatusCarteira('');
    onClearFilters();
  };

  const filtersContent = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Data Início */}
      <div className="space-y-2">
        <Label>Data Início</Label>
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
        />
      </div>

      {/* Data Fim */}
      <div className="space-y-2">
        <Label>Data Fim</Label>
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_AGENDAMENTO.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tipo de Exame */}
      <div className="space-y-2">
        <Label>Tipo de Exame</Label>
        <Select value={tipoExame} onValueChange={setTipoExame}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TIPOS_EXAME.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Local de Atendimento */}
      <div className="space-y-2">
        <Label>Local de Atendimento</Label>
        <Select value={localAtendimentoId} onValueChange={setLocalAtendimentoId}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {locais.map((local) => (
              <SelectItem key={local.id} value={local.id}>{local.cidade || local.nome_local}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Empresa */}
      <div className="space-y-2">
        <Label>Empresa</Label>
        <Combobox
          options={empresasOptions}
          value={empresa}
          onChange={setEmpresa}
          placeholder="Todas as empresas"
          searchPlaceholder="Buscar empresa..."
          emptyText="Nenhuma empresa encontrada"
        />
      </div>

      {/* Centro de Custo */}
      <div className="space-y-2">
        <Label>Centro de Custo</Label>
        <Combobox
          options={centrosCustoOptions}
          value={contrato}
          onChange={setContrato}
          placeholder="Todos os centros de custo"
          searchPlaceholder="Buscar centro de custo..."
          emptyText="Nenhum centro de custo encontrado"
        />
      </div>

      {/* Função */}
      <div className="space-y-2">
        <Label>Função</Label>
        <Combobox
          options={funcoesOptions}
          value={funcao}
          onChange={setFuncao}
          placeholder="Todas as funções"
          searchPlaceholder="Buscar função..."
          emptyText="Nenhuma função encontrada"
        />
      </div>

      {/* Nome do Colaborador */}
      <div className="space-y-2">
        <Label>Nome do Colaborador</Label>
        <Input
          placeholder="Buscar colaborador..."
          value={nomeColaborador}
          onChange={(e) => setNomeColaborador(e.target.value)}
        />
      </div>

      {/* CPF */}
      <div className="space-y-2">
        <Label>CPF</Label>
        <Input
          placeholder="Buscar CPF..."
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
        />
      </div>

      {/* Integração */}
      <div className="space-y-2">
        <Label>Integração</Label>
        <Select value={statusIntegracao} onValueChange={setStatusIntegracao}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_INTEGRACAO.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Carteira */}
      <div className="space-y-2">
        <Label>Status Carteira</Label>
        <Select value={statusCarteira} onValueChange={setStatusCarteira}>
          <SelectTrigger>
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_CARTEIRA.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Botões */}
      <div className="col-span-full flex flex-wrap gap-2 pt-2">
        <Button onClick={handleApplyFilters}>
          <Filter className="h-4 w-4 mr-2" />
          Aplicar Filtros
        </Button>
        <Button variant="outline" onClick={handleClear}>
          <X className="h-4 w-4 mr-2" />
          Limpar
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Card className="p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex justify-between">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {filtersContent}
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        Filtros
      </h3>
      {filtersContent}
    </Card>
  );
};
