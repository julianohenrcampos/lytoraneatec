import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, Loader2, Users, FileText, Check, ChevronRight, ChevronLeft, Info, Lock, User, Send } from "lucide-react";
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
  
  // Form data
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [centroCustoId, setCentroCustoId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [convocadosPre, setConvocadosPre] = useState<FuncionarioPreConvocado[]>([]);
  
  // Selection state for adding funcionarios
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState('');
  
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

  // Funcionarios query (com função e valor de diária)
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-com-funcao'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcionarios')
        .select(`
          id,
          nome_completo,
          cpf,
          funcao_id,
          bd_funcoes (
            id,
            nome_funcao,
            valor_diaria
          )
        `)
        .eq('status', 'Ativo')
        .order('nome_completo');
      return data || [];
    }
  });

  // Aprovadores query (funcionários com função Gerente Regional)
  const { data: aprovadores = [] } = useQuery({
    queryKey: ['gerentes-regionais-aprovadores'],
    queryFn: async () => {
      // Primeiro buscar o ID da função "Gerente Regional"
      const { data: funcaoGerente } = await supabase
        .from('bd_funcoes')
        .select('id')
        .eq('nome_funcao', 'Gerente Regional')
        .single();

      if (!funcaoGerente?.id) {
        return [];
      }

      // Buscar funcionários com essa função
      const { data: funcionarios } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email')
        .eq('funcao_id', funcaoGerente.id)
        .eq('status', 'Ativo')
        .order('nome_completo');

      return funcionarios || [];
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
        setData(editingSolicitacao.data);
        setCentroCustoId(editingSolicitacao.centro_custo_id);
        setJustificativa(editingSolicitacao.justificativa);
        const convocadosRaw = (editingSolicitacao as any).convocados_pre;
        if (convocadosRaw && Array.isArray(convocadosRaw)) {
          setConvocadosPre(convocadosRaw);
        } else {
          setConvocadosPre([]);
        }
      } else {
        setData(format(new Date(), 'yyyy-MM-dd'));
        setCentroCustoId('');
        setJustificativa('');
        setConvocadosPre([]);
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
  const aprovadorNome = useMemo(() => {
    if (!selectedCentroCusto?.aprovador_diarias_id) return null;
    const aprov = aprovadores.find((a: any) => a.id === selectedCentroCusto.aprovador_diarias_id);
    return aprov?.nome_completo || 'Aprovador não encontrado';
  }, [selectedCentroCusto, aprovadores]);

  // Funcionarios available (not already added)
  const funcionariosDisponiveis = useMemo(() => {
    const addedIds = convocadosPre.map(c => c.funcionario_id);
    return funcionarios.filter((f: any) => 
      !addedIds.includes(f.id) && 
      f.bd_funcoes  // Apenas exigir que tenha função associada
    );
  }, [funcionarios, convocadosPre]);

  // Add funcionario
  const handleAddFuncionario = () => {
    if (!selectedFuncionarioId) return;
    
    const func = funcionarios.find((f: any) => f.id === selectedFuncionarioId);
    if (!func || !func.bd_funcoes) return;

    const novoConvocado: FuncionarioPreConvocado = {
      funcionario_id: func.id,
      funcao_id: func.funcao_id,
      valor_diaria: func.bd_funcoes.valor_diaria || 0,
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

  // Calculate total
  const totalValor = useMemo(() => {
    return convocadosPre.reduce((sum, c) => sum + c.valor_diaria, 0);
  }, [convocadosPre]);

  // Validation
const canProceedToDados = data && centroCustoId;
  const canProceedToFuncionarios = convocadosPre.length > 0 && justificativa.trim().length >= 10;
  const canSave = canProceedToDados && canProceedToFuncionarios;

  // Build form data
  const buildFormData = (): SolicitacaoFormData => ({
    data,
    centro_custo_id: centroCustoId,
    justificativa,
    convocados_pre: convocadosPre.map(c => ({
      funcionario_id: c.funcionario_id,
      funcao_id: c.funcao_id,
      valor_diaria: c.valor_diaria
    }))
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editingSolicitacao ? 'Editar Solicitação' : 'Nova Solicitação de Diária'}
          </DialogTitle>
          <DialogDescription>
            {step === 'dados' && 'Preencha os dados básicos da solicitação.'}
            {step === 'funcionarios' && 'Selecione os funcionários que participarão.'}
            {step === 'revisao' && 'Revise os dados antes de salvar.'}
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

        <ScrollArea className="max-h-[50vh] pr-4">
          {/* Step 1: Dados Básicos */}
          {step === 'dados' && (
            <div className="space-y-4">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
              
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
                        <Check className="h-3 w-3 text-green-600" />
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
                  {usuarioLogado?.email && usuarioLogado.email !== user?.email && (
                    <span className="text-xs text-muted-foreground">({usuarioLogado.email})</span>
                  )}
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
                      <TableHead className="text-right">Valor Diária</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convocadosPre.map((conv) => (
                      <TableRow key={conv.funcionario_id}>
                        <TableCell>{conv.nome_funcionario}</TableCell>
                        <TableCell>{conv.nome_funcao}</TableCell>
                        <TableCell className="text-right">
                          R$ {conv.valor_diaria.toFixed(2)}
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
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {totalValor.toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
                      <Label className="text-muted-foreground">Data</Label>
                      <p className="font-medium">
                        {formatBrazilianDateForDisplay(data)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Centro de Custo</Label>
                      <p className="font-medium">
                        {selectedCentroCusto?.codigo_centro_custo} - {selectedCentroCusto?.nome_centro_custo}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Aprovador</Label>
                      <p className="font-medium">
                        {aprovadorNome || 'Não definido (qualquer admin)'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Responsável</Label>
                      <p className="font-medium">
                        {usuarioLogado?.nome_completo || user?.email || '-'}
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
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {convocadosPre.map((conv) => (
                        <TableRow key={conv.funcionario_id}>
                          <TableCell>{conv.nome_funcionario}</TableCell>
                          <TableCell>{conv.nome_funcao}</TableCell>
                          <TableCell className="text-right">R$ {conv.valor_diaria.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold">
                        <TableCell colSpan={2}>Total Estimado</TableCell>
                        <TableCell className="text-right">R$ {totalValor.toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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
