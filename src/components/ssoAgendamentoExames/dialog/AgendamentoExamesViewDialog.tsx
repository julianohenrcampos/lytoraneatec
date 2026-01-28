import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { getStatusColor } from '@/types/ssoAgendamentoExames';
import { Loader2, Building2, User, Calendar, Clock, MapPin, Stethoscope, FileText, UserCheck } from 'lucide-react';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

interface AgendamentoExamesViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId: string | undefined;
}

export const AgendamentoExamesViewDialog: React.FC<AgendamentoExamesViewDialogProps> = ({
  open,
  onOpenChange,
  agendamentoId
}) => {
  const { agendamento, isLoading } = useAgendamentoExames(agendamentoId);

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!agendamento) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span>Agendamento de Exame</span>
              <Badge variant={getStatusColor(agendamento.status)}>
                {agendamento.status}
              </Badge>
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Dados do Colaborador */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados do Colaborador
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium">{agendamento.nome_colaborador}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Função:</span>
                  <p className="font-medium">{agendamento.funcao}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CPF:</span>
                  <p className="font-medium">{formatCPF(agendamento.cpf)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">RG:</span>
                  <p className="font-medium">{agendamento.rg || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data de Nascimento:</span>
                  <p className="font-medium">{formatBrazilianDateForDisplay(agendamento.data_nascimento)}</p>
                </div>
              </div>
            </Card>

            {/* Empresa e Contrato */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Empresa e Contrato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Empresa:</span>
                  <p className="font-medium">{agendamento.empresa}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contrato/Obra:</span>
                  <p className="font-medium">{agendamento.contrato || '-'}</p>
                </div>
              </div>
            </Card>

            {/* Dados do Exame */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Dados do Exame
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo de Exame:</span>
                  <div className="mt-1">
                    <Badge variant="outline">{agendamento.tipo_exame}</Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Data do Agendamento:</span>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatBrazilianDateForDisplay(agendamento.data_agendamento)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Horário:</span>
                  <p className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatTime(agendamento.horario_agendamento)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Local de Atendimento:</span>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {agendamento.bd_locais_atendimento?.nome_local || '-'}
                  </p>
                </div>
                {agendamento.bd_locais_atendimento?.endereco && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Endereço:</span>
                    <p className="font-medium">
                      {agendamento.bd_locais_atendimento.endereco}
                      {agendamento.bd_locais_atendimento.cidade && ` - ${agendamento.bd_locais_atendimento.cidade}`}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Observações */}
            {agendamento.observacoes && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Observações
                </h3>
                <p className="text-sm whitespace-pre-wrap">{agendamento.observacoes}</p>
              </Card>
            )}

            {/* Responsável */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Responsável
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Técnico de Segurança:</span>
                  <p className="font-medium">{agendamento.tecnico_seguranca || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Documentos Anexados:</span>
                  <p className="font-medium">
                    <Badge variant={agendamento.documentos_anexados ? 'default' : 'secondary'}>
                      {agendamento.documentos_anexados ? 'Sim' : 'Não'}
                    </Badge>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
