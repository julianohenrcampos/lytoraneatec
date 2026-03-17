import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Desligamento, getStatusDesligamentoLabel, getStatusDesligamentoColor, getTipoDesligamentoLabel } from '@/types/desligamento';
import { CalendarDays, User, FileText, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desligamento: Desligamento | null;
}

export const DesligamentoDetailsDialog: React.FC<Props> = ({ open, onOpenChange, desligamento }) => {
  if (!desligamento) return null;
  const func = desligamento.bd_funcionarios;

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes do Desligamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Funcionário */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{func?.nome_completo || '—'}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {func?.bd_funcoes?.nome_funcao || ''} · {func?.bd_empresas?.nome_empresa || ''} · CPF: {func?.cpf}
            </p>
          </div>

          {/* Status e tipo */}
          <div className="flex gap-2">
            <Badge variant={getStatusDesligamentoColor(desligamento.status as any)}>
              {getStatusDesligamentoLabel(desligamento.status as any)}
            </Badge>
            <Badge variant="secondary">
              {getTipoDesligamentoLabel(desligamento.tipo_desligamento as any)}
            </Badge>
            {!desligamento.recontratavel && (
              <Badge variant="destructive">Não Recontratável</Badge>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>Solicitação: {formatDate(desligamento.data_solicitacao?.split('T')[0])}</span>
            </div>
            {desligamento.tipo_desligamento === 'com_aviso' && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Aviso: {formatDate(desligamento.data_inicio_aviso)} → {formatDate(desligamento.data_fim_aviso)} ({desligamento.dias_aviso} dias)</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>Desligamento efetivo: {formatDate(desligamento.data_efetiva_desligamento)}</span>
            </div>
          </div>

          {/* Motivo */}
          {desligamento.motivo && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" /> Motivo
              </div>
              <p className="text-sm text-muted-foreground">{desligamento.motivo}</p>
            </div>
          )}

          {/* Observações */}
          {desligamento.observacoes && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Observações</p>
              <p className="text-sm text-muted-foreground">{desligamento.observacoes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
