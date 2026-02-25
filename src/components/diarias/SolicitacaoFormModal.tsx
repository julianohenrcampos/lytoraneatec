import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, Loader2, Users, FileText, Check, ChevronRight, ChevronLeft, Info, Lock, User, Send, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SolicitacaoFormData, FuncionarioPreConvocado, DiariaSolicitacao } from "@/types/diarias";
import { useFeriadosPeriodo } from "@/hooks/diarias/useFeriados";
import { 
  analisarPeriodo, 
  calcularEstimativaTotal, 
  validarPeriodo,
  formatCurrency 
} from "@/utils/diariasPeriodoUtils";
import { PeriodoResumo } from "./PeriodoResumo";
import { EstimativaAviso } from "./EstimativaAviso";
import { SimulacaoValores } from "./SimulacaoValores";

interface CentroCustoComAprovador {
  id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  aprovador_diarias_id: string | null;
}

interface SolicitacaoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SolicitacaoFormData) => Promise<void>;
  onSaveAndSend?: (data: SolicitacaoFormData) => Promise<void>;
  editingSolicitacao?: DiariaSolicitacao | null;
  isSaving?: boolean;
}

type Step = 'dados' | 'funcionarios' | 'revisao';

export function SolicitacaoFormModal({
  isOpen,
  onClose,
  onSave,
  onSaveAndSend,
  editingSolicitacao,
  isSaving = false
}: SolicitacaoFormModalProps) {
  const [step, setStep] = useState<Step>('dados');
  const { user } = useAuth();
  
  // Form data - Período
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [consideraFdsFeriado, setConsideraFdsFeriado] = useState(false);
  
  const [centroCustoId, setCentroCustoId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [convocadosPre, setConvocadosPre] = useState<FuncionarioPreConvocado[]>([]);
  const [responsavelCampoId, setResponsavelCampoId] = useState('');
  const [engenheiroSolicitanteId, setEngenheiroSolicitanteId] = useState('');
  
  // Selection state for adding funcionarios
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('');
  
  // Buscar feriados do período
  const { data: feriados = [] } = useFeriadosPeriodo(dataInicio, dataFim);
  
  // Analisar período em tempo real
  const analise = useMemo(() => {
    const feriadosFormatados = feriados.map(f => ({ data: f.data, nome: f.nome }));
    return analisarPeriodo(dataInicio, dataFim, feriadosFormatados, consideraFdsFeriado);
  }, [dataInicio, dataFim, feriados, consideraFdsFeriado]);
  
  // Validar período
  const periodoValidacao = useMemo(() => {
    return validarPeriodo(dataInicio, dataFim, 30);
  }, [dataInicio, dataFim]);
  
  // Centro de custos query com fallback
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-com-aprovador'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo, aprovador_diarias_id')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      
      // Fallback se campo não existir (código de erro 42703)
      if (error && error.code === '42703') {
        const { data: fallbackData } = await supabase
          .from('bd_centros_custo')
          .select('id, codigo_centro_custo, nome_centro_custo')
          .eq('situacao', 'Ativo')
          .order('nome_centro_custo');
        return (fallbackData || []).map(cc => ({
          ...cc,
          aprovador_diarias_id: null
        })) as CentroCustoComAprovador[];
      }
      
      return (data as unknown as CentroCustoComAprovador[]) || [];
    }
  });

  // Funcionarios query via RPC (SECURITY DEFINER - ignora RLS departamental)
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-para-diarias'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_funcionarios_para_diarias');
      return (data || []).map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        cpf: f.cpf,
        funcao_id: f.funcao_id,
        bd_funcoes: f.funcao_nome ? {
          id: f.funcao_id,
          nome_funcao: f.funcao_nome,
          valor_diaria: f.valor_diaria,
          valor_diaria_exclusiva: f.valor_diaria_exclusiva,
          valor_refeicao: f.valor_refeicao
        } : null
      }));
    }
  });

  // Aprovadores query (funcionários com função Gerente Regional)
  const { data: aprovadores = [] } = useQuery({
    queryKey: ['gerentes-regionais-aprovadores'],
    queryFn: async () => {
      const { data: funcaoGerente } = await supabase
        .from('bd_funcoes')
        .select('id')
        .eq('nome_funcao', 'Gerente Regional')
        .single();

      if (!funcaoGerente?.id) return [];

      const { data: funcionariosData } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email')
        .eq('funcao_id', funcaoGerente.id)
        .eq('status', 'Ativo')
        .order('nome_completo');

      return funcionariosData || [];
    }
  });

  // Dados do usuário logado (responsável pela solicitação)
  const { data: usuarioLogado } = useQuery({
    queryKey: ['usuario-logado-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, nome_completo, email')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      if (editingSolicitacao) {
        setDataInicio(editingSolicitacao.data_inicio);
        setDataFim(editingSolicitacao.data_fim);
        setConsideraFdsFeriado(editingSolicitacao.considera_fds_feriado || false);
        setCentroCustoId(editingSolicitacao.centro_custo_id);
        setJustificativa(editingSolicitacao.justificativa);
        setResponsavelCampoId(editingSolicitacao.responsavel_campo_id || '');
        setEngenheiroSolicitanteId(editingSolicitacao.engenheiro_solicitante_id || '');
        const convocadosRaw = editingSolicitacao.convocados_pre;
        if (convocadosRaw && Array.isArray(convocadosRaw)) {
          setConvocadosPre(convocadosRaw);
        } else {
          setConvocadosPre([]);
        }
      } else {
        const hoje = format(new Date(), 'yyyy-MM-dd');
        setDataInicio(hoje);
        setDataFim(hoje);
        setConsideraFdsFeriado(false);
        setCentroCustoId('');
        setJustificativa('');
        setConvocadosPre([]);
        setResponsavelCampoId('');
        setEngenheiroSolicitanteId('');
      }
      setStep('dados');
      setSelectedFuncionarioId('');
    }
  }, [isOpen, editingSolicitacao]);

  // Get selected centro de custo info
  const selectedCentroCusto = useMemo(() => {
    return centrosCusto.find((cc) => cc.id === centroCustoId);
  }, [centrosCusto, centroCustoId]);

  // Get aprovador name
  // Get apontador name
  const apontadorNome = useMemo(() => {
    if (!responsavelCampoId) return null;
    const func = funcionarios.find((f: any) => f.id === responsavelCampoId);
    return func?.nome_completo || null;
  }, [responsavelCampoId, funcionarios]);

  const aprovadorNome = useMemo(() => {
    if (!selectedCentroCusto?.aprovador_diarias_id) return null;
    const aprov = funcionarios.find((f: any) => f.id === selectedCentroCusto.aprovador_diarias_id);
    return aprov?.nome_completo || 'Aprovador não encontrado';
  }, [selectedCentroCusto, funcionarios]);

  // Funcionarios available (not already added)
  const funcionariosDisponiveis = useMemo(() => {
    const addedIds = convocadosPre.map(c => c.funcionario_id);
    return funcionarios.filter((f: any) => 
      !addedIds.includes(f.id)
    );
  }, [funcionarios, convocadosPre]);

  // Lista filtrada para Engenheiro Solicitante (apenas engenheiros e gerentes regionais)
  const engenheirosEGerentes = useMemo(() => {
    return funcionarios.filter((f: any) => {
      const nomeFuncao = f.bd_funcoes?.nome_funcao?.toLowerCase() || '';
      return nomeFuncao.includes('engenheiro') || nomeFuncao.includes('gerente regional');
    });
  }, [funcionarios]);

  // Add funcionario
  const handleAddFuncionario = () => {
    if (!selectedFuncionarioId) return;
    
    const func = funcionarios.find((f: any) => f.id === selectedFuncionarioId);
    if (!func || !func.bd_funcoes) return;

    const novoConvocado: FuncionarioPreConvocado = {
      funcionario_id: func.id,
      funcao_id: func.funcao_id,
      valor_diaria: func.bd_funcoes.valor_diaria || 0,
      valor_diaria_exclusiva: func.bd_funcoes.valor_diaria_exclusiva || undefined,
      valor_refeicao: func.bd_funcoes.valor_refeicao || 0,
      nome_funcionario: func.nome_completo,
      nome_funcao: func.bd_funcoes.nome_funcao
    };

    setConvocadosPre([...convocadosPre, novoConvocado]);
    setSelectedFuncionarioId('');
  };

  // Remove funcionario
  const handleRemoveFuncionario = (funcionarioId: string) => {
    setConvocadosPre(convocadosPre.filter(c => c.funcionario_id !== funcionarioId));
  };

  // Calculate simulação de valores
  const simulacao = useMemo(() => {
    return calcularEstimativaTotal(convocadosPre, analise, consideraFdsFeriado);
  }, [convocadosPre, analise, consideraFdsFeriado]);

  // Validation
  const canProceedToDados = dataInicio && dataFim && centroCustoId && periodoValidacao.valido;
  const canProceedToFuncionarios = convocadosPre.length > 0 && justificativa.trim().length >= 10;
  const canSave = canProceedToDados && canProceedToFuncionarios;

  // Build form data
  const buildFormData = (): SolicitacaoFormData => ({
    data_inicio: dataInicio,
    data_fim: dataFim,
    centro_custo_id: centroCustoId,
    justificativa,
    considera_fds_feriado: consideraFdsFeriado,
    qtde_dias_uteis_estimado: analise.diasUteis,
    qtde_fds_estimado: analise.finaisDeSemana,
    qtde_feriados_estimado: analise.feriados,
    valor_estimado_total: simulacao.totalEstimado,
    convocados_pre: convocadosPre.map(c => ({
      funcionario_id: c.funcionario_id,
      funcao_id: c.funcao_id,
      valor_diaria: c.valor_diaria,
      valor_diaria_exclusiva: c.valor_diaria_exclusiva,
      valor_refeicao: c.valor_refeicao,
      nome_funcionario: c.nome_funcionario,
      nome_funcao: c.nome_funcao
    })),
    responsavel_campo_id: responsavelCampoId || undefined,
    engenheiro_solicitante_id: engenheiroSolicitanteId || undefined
  });

  // Handle save as draft
  const handleSave = async () => {
    await onSave(buildFormData());
    onClose();
  };

  // Handle save and send for authorization
  const handleSaveAndSend = async () => {
    if (onSaveAndSend) {
      await onSaveAndSend(buildFormData());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editingSolicitacao ? 'Editar Solicitação' : 'Nova Solicitação de Diária'}
          </DialogTitle>
          <DialogDescription>
            {step === 'dados' && 'Defina o período e centro de custo da solicitação.'}
            {step === 'funcionarios' && 'Selecione os funcionários que participarão.'}
            {step === 'revisao' && 'Revise os dados e valores estimados.'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Badge variant={step === 'dados' ? 'default' : 'secondary'} className="gap-1">
            <FileText className="h-3 w-3" />
            Dados
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'funcionarios' ? 'default' : 'secondary'} className="gap-1">
            <Users className="h-3 w-3" />
            Funcionários
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'revisao' ? 'default' : 'secondary'} className="gap-1">
            <Check className="h-3 w-3" />
            Revisão
          </Badge>
        </div>

        <ScrollArea className="max-h-[55vh] pr-4">
          {/* Step 1: Dados Básicos */}
          {step === 'dados' && (
            <div className="space-y-4">
              {/* Período */}
              <div className="space-y-2">
                <Label>Período da Solicitação *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Início</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Fim</Label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </div>
                {!periodoValidacao.valido && periodoValidacao.erro && (
                  <p className="text-sm text-destructive">{periodoValidacao.erro}</p>
                )}
              </div>
              
              {/* Toggle FDS/Feriados */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="considera-fds" className="text-sm font-medium">
                    Considerar finais de semana e feriados
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Quando ativo, inclui FDS e feriados no cálculo estimado
                  </p>
                </div>
                <Switch
                  id="considera-fds"
                  checked={consideraFdsFeriado}
                  onCheckedChange={setConsideraFdsFeriado}
                />
              </div>
              
              {/* Resumo do Período */}
              {periodoValidacao.valido && (
                <PeriodoResumo
                  dataInicio={dataInicio}
                  dataFim={dataFim}
                  analise={analise}
                  consideraFdsFeriado={consideraFdsFeriado}
                />
              )}
              
              {/* Aviso de Estimativa */}
              <EstimativaAviso />
              
              {/* Centro de Custo */}
              <div>
                <Label>Centro de Custo *</Label>
                <Combobox
                  options={centrosCusto.map((cc) => ({
                    value: cc.id,
                    label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
                  }))}
                  value={centroCustoId}
                  onChange={setCentroCustoId}
                  placeholder="Selecione o centro de custo..."
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado"
                />
                
                {selectedCentroCusto && (
                  <div className="mt-2 p-3 bg-muted rounded-md space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium">Aprovador:</span>
                      <span>
                        {aprovadorNome || <span className="text-destructive">Não definido</span>}
                      </span>
                    </div>
                    {selectedCentroCusto.aprovador_diarias_id ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-primary" />
                        Este centro de custo tem aprovador definido
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Sem aprovador definido - qualquer administrador pode aprovar
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Campo Engenheiro Solicitante */}
              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Engenheiro Solicitante
                </Label>
                <Combobox
                  options={engenheirosEGerentes.map((f: any) => ({
                    value: f.id,
                    label: f.nome_completo
                  }))}
                  value={engenheiroSolicitanteId}
                  onChange={setEngenheiroSolicitanteId}
                  placeholder="Selecione o engenheiro responsável..."
                  searchPlaceholder="Buscar engenheiro..."
                  emptyText="Nenhum engenheiro ou gerente regional encontrado"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Engenheiro responsável por esta solicitação de diária
                </p>
              </div>

              {/* Campo Apontador (Responsável em Campo) */}
              <div>
                <Label className="flex items-center gap-2">
                  <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  Apontador (Responsável em Campo)
                </Label>
                <Combobox
                  options={funcionarios.map((f: any) => ({
                    value: f.id,
                    label: f.nome_completo
                  }))}
                  value={responsavelCampoId}
                  onChange={setResponsavelCampoId}
                  placeholder="Selecione o funcionário apontador..."
                  searchPlaceholder="Buscar funcionário..."
                  emptyText="Nenhum funcionário encontrado"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este funcionário será responsável por registrar presença em campo.
                </p>
              </div>
              
              {/* Campo Responsável pela Solicitação */}
              <div>
                <Label className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Responsável pela Solicitação
                </Label>
                <div className="mt-1.5 p-3 bg-muted/50 border rounded-md flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {usuarioLogado?.nome_completo || user?.email || 'Carregando...'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Preenchido automaticamente com o usuário logado
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Funcionários */}
          {step === 'funcionarios' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    options={funcionariosDisponiveis.map((f: any) => ({
                      value: f.id,
                      label: f.nome_completo
                    }))}
                    value={selectedFuncionarioId}
                    onChange={setSelectedFuncionarioId}
                    placeholder="Selecione um funcionário..."
                    searchPlaceholder="Buscar funcionário..."
                    emptyText="Nenhum funcionário disponível"
                  />
                </div>
                <Button 
                  onClick={handleAddFuncionario}
                  disabled={!selectedFuncionarioId}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {convocadosPre.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Nenhum funcionário adicionado. Selecione ao menos um funcionário para prosseguir.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-right">Diária</TableHead>
                      <TableHead className="text-right">FDS/Fer</TableHead>
                      <TableHead className="text-right">Refeição</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convocadosPre.map((conv) => (
                      <TableRow key={conv.funcionario_id}>
                        <TableCell>{conv.nome_funcionario}</TableCell>
                        <TableCell>{conv.nome_funcao}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(conv.valor_diaria)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria * 1.2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(conv.valor_refeicao || 0)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveFuncionario(conv.funcionario_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Simulação de Valores */}
              {convocadosPre.length > 0 && (
                <SimulacaoValores
                  simulacao={simulacao}
                  diasUteis={analise.diasUteis}
                  diasFdsFeriados={consideraFdsFeriado ? analise.finaisDeSemana + analise.feriados : 0}
                  diasParaRefeicao={consideraFdsFeriado ? analise.diasUteis + analise.finaisDeSemana + analise.feriados : analise.diasUteis}
                />
              )}

              <div className="pt-4 border-t">
                <Label>Justificativa * (mínimo 10 caracteres)</Label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Descreva o motivo da solicitação de diária..."
                  rows={4}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {justificativa.length}/10 caracteres mínimos
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Revisão */}
          {step === 'revisao' && (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Período</Label>
                      <p className="font-medium">
                        {formatBrazilianDateForDisplay(dataInicio)}
                        {dataFim !== dataInicio && (
                          <> → {formatBrazilianDateForDisplay(dataFim)}</>
                        )}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Centro de Custo</Label>
                      <p className="font-medium">
                        {selectedCentroCusto?.codigo_centro_custo} - {selectedCentroCusto?.nome_centro_custo}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Dias úteis</Label>
                      <p className="font-medium">{analise.diasUteis}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">FDS</Label>
                      <p className="font-medium">{analise.finaisDeSemana}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Feriados</Label>
                      <p className="font-medium">{analise.feriados}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Considera FDS/Feriados</Label>
                      <Badge variant={consideraFdsFeriado ? 'default' : 'outline'}>
                        {consideraFdsFeriado ? 'Sim' : 'Não'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Aprovador</Label>
                      <p className="font-medium">
                        {aprovadorNome || 'Não definido (qualquer admin)'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Responsável</Label>
                      <p className="font-medium">
                        {usuarioLogado?.nome_completo || user?.email || '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Apontador</Label>
                      <p className="font-medium">
                        {apontadorNome || 'Não definido'}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground">Justificativa</Label>
                    <p className="text-sm">{justificativa}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <Label className="text-muted-foreground mb-2 block">
                    Funcionários Convocados ({convocadosPre.length})
                  </Label>
                  <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Diária</TableHead>
                        <TableHead className="text-right">FDS/Fer</TableHead>
                        <TableHead className="text-right">Refeição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {convocadosPre.map((conv) => (
                        <TableRow key={conv.funcionario_id}>
                          <TableCell>{conv.nome_funcionario}</TableCell>
                          <TableCell>{conv.nome_funcao}</TableCell>
                          <TableCell className="text-right">{formatCurrency(conv.valor_diaria)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria * 1.2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(conv.valor_refeicao || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Valor Total Estimado */}
              <SimulacaoValores
                simulacao={simulacao}
                diasUteis={analise.diasUteis}
                diasFdsFeriados={consideraFdsFeriado ? analise.finaisDeSemana + analise.feriados : 0}
                diasParaRefeicao={consideraFdsFeriado ? analise.diasUteis + analise.finaisDeSemana + analise.feriados : analise.diasUteis}
              />
              
              <EstimativaAviso />
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          {step !== 'dados' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'revisao' ? 'funcionarios' : 'dados')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          
          {step === 'dados' && (
            <Button 
              onClick={() => setStep('funcionarios')}
              disabled={!canProceedToDados}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          
          {step === 'funcionarios' && (
            <Button 
              onClick={() => setStep('revisao')}
              disabled={!canProceedToFuncionarios}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          
          {step === 'revisao' && (
            <>
              <Button 
                variant="outline"
                onClick={handleSave}
                disabled={!canSave || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Rascunho
              </Button>
              {onSaveAndSend && (
                <Button 
                  onClick={handleSaveAndSend}
                  disabled={!canSave || isSaving}
                >
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Send className="h-4 w-4 mr-2" />
                  Salvar e Enviar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
