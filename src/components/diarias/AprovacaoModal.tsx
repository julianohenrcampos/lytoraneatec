import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, AlertTriangle, User, Calendar, Building2, Users, Loader2, Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DiariaSolicitacao, FuncionarioPreConvocado } from "@/types/diarias";
import { formatCurrency } from "@/utils/diariasPeriodoUtils";
import { useDiariasDataScope } from "@/hooks/diarias/useDiariasDataScope";

const SEGREGACAO_MSG_CRIADOR =
  "Você criou esta solicitação. A aprovação deve ser feita por outro aprovador autorizado.";

interface AprovacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: DiariaSolicitacao | null;
  action: 'autorizar' | 'reprovar';
  onConfirm: (data: {
    responsavel_campo_id?: string;
    observacao_gerente?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function AprovacaoModal({
  isOpen,
  onClose,
  solicitacao,
  action,
  onConfirm,
  isLoading = false
}: AprovacaoModalProps) {
  const [observacaoGerente, setObservacaoGerente] = useState<string>(
    solicitacao?.observacao_gerente || ''
  );

  // D1.1: detectar bloqueio por segregação para exibir motivo claro ao usuário.
  // Não altera a regra de aprovação — apenas explica o porquê do bloqueio.
  const { canApproveSolicitacao, getMotivoNaoAprovacao } = useDiariasDataScope();
  const motivoBloqueio = solicitacao ? getMotivoNaoAprovacao(solicitacao) : null;
  const bloqueadoPorSegregacao =
    !!solicitacao && action === 'autorizar' && motivoBloqueio === 'segregacao_criador' && !canApproveSolicitacao(solicitacao);

  // Sincronizar observação quando a solicitação mudar
  useEffect(() => {
    if (solicitacao) {
      setObservacaoGerente(solicitacao.observacao_gerente || '');
    }
  }, [solicitacao?.id, isOpen]);

  // Buscar funcionários ativos para seleção do responsável
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-ativos-apontadores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo')
        .eq('status', 'Ativo')
        .order('nome_completo');
      return data || [];
    }
  });

  // Buscar nome do responsável pelo ID
  const nomeResponsavel = useMemo(() => {
    if (!solicitacao?.responsavel_campo_id) return null;
    const func = funcionarios.find((f: any) => f.id === solicitacao.responsavel_campo_id);
    return func?.nome_completo || 'Carregando...';
  }, [solicitacao?.responsavel_campo_id, funcionarios]);

  // Parse convocados_pre
  const convocados = useMemo(() => {
    if (!solicitacao?.convocados_pre) return [];
    if (Array.isArray(solicitacao.convocados_pre)) {
      return solicitacao.convocados_pre as FuncionarioPreConvocado[];
    }
    return [];
  }, [solicitacao?.convocados_pre]);

  // Calcular dias do período
  const diasPeriodo = useMemo(() => {
    if (!solicitacao) return 0;
    const inicio = new Date(solicitacao.data_inicio);
    const fim = new Date(solicitacao.data_fim);
    return Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [solicitacao]);

  // Validação: responsável é obrigatório para aprovação
  const canConfirm = action === 'reprovar' || solicitacao?.responsavel_campo_id;

  const handleConfirm = async () => {
    try {
      await onConfirm({
        responsavel_campo_id: action === 'autorizar' ? solicitacao?.responsavel_campo_id : undefined,
        observacao_gerente: observacaoGerente.trim() || undefined
      });
    } catch (error) {
      console.error('Erro na aprovação:', error);
    } finally {
      onClose();
    }
  };

  if (!solicitacao) return null;

  const isAprovacao = action === 'autorizar';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAprovacao ? (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Autorizar Solicitação
              </>
            ) : (
              <>
                <X className="h-5 w-5 text-red-500" />
                Reprovar Solicitação
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAprovacao
              ? 'Revise os dados e selecione o responsável em campo antes de aprovar.'
              : 'Informe o motivo da reprovação.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* D1.1: aviso de segregação para o criador da solicitação */}
          {bloqueadoPorSegregacao && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{SEGREGACAO_MSG_CRIADOR}</AlertDescription>
            </Alert>
          )}

          {/* Resumo da Solicitação */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                📋 Resumo da Solicitação
              </h4>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Período:</span>
                </div>
                <div>
                  {format(new Date(solicitacao.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
                  {solicitacao.data_fim !== solicitacao.data_inicio && (
                    <> → {format(new Date(solicitacao.data_fim), 'dd/MM/yyyy', { locale: ptBR })}</>
                  )}
                  <span className="text-muted-foreground ml-1">({diasPeriodo} dias)</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Centro de Custo:</span>
                </div>
                <div>
                  {solicitacao.bd_centros_custo?.codigo_centro_custo} - {solicitacao.bd_centros_custo?.nome_centro_custo}
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Funcionários:</span>
                </div>
                <div>
                  {convocados.length} selecionado{convocados.length !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Valor Estimado:</span>
                <Badge variant="secondary" className="text-base">
                  {formatCurrency(solicitacao.valor_estimado_total || 0)}
                </Badge>
              </div>
              
              {solicitacao.considera_fds_feriado && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Inclui finais de semana e feriados
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campo Responsável em Campo (apenas para aprovação - somente leitura) */}
          {isAprovacao && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Responsável em Campo (Apontador)
              </Label>
              
              {solicitacao.responsavel_campo_id ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{nomeResponsavel}</span>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum responsável em campo foi definido na solicitação.
                  </AlertDescription>
                </Alert>
              )}
              
              <p className="text-xs text-muted-foreground">
                Este funcionário será responsável por registrar presença e horários em campo.
              </p>
            </div>
          )}

          {/* Observação do Gerente */}
          <div className="space-y-2">
            <Label>
              Observação do Gerente {!isAprovacao && <span className="text-destructive">(recomendado)</span>}
            </Label>
            <Textarea
              placeholder={isAprovacao 
                ? "Observações sobre a aprovação (opcional)..." 
                : "Informe o motivo da reprovação..."}
              value={observacaoGerente}
              onChange={(e) => setObservacaoGerente(e.target.value)}
              rows={3}
            />
          </div>

          {/* Aviso sobre apontamento automático */}
          {isAprovacao && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Ao aprovar, será criado automaticamente um <strong>Apontamento de Campo</strong> para registro de presença.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant={isAprovacao ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading || bloqueadoPorSegregacao}
            title={bloqueadoPorSegregacao ? SEGREGACAO_MSG_CRIADOR : undefined}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : isAprovacao ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Confirmar Aprovação
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Confirmar Reprovação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
