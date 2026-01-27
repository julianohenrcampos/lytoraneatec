import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AgendamentoExame, getStatusColor, STATUS_AGENDAMENTO } from '@/types/ssoAgendamentoExames';
import { Eye, Pencil, Trash2, Paperclip, Calendar, Clock, Building2, User, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendamentoExamesMobileCardsProps {
  agendamentos: AgendamentoExame[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAnexos: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export const AgendamentoExamesMobileCards: React.FC<AgendamentoExamesMobileCardsProps> = ({
  agendamentos,
  onView,
  onEdit,
  onDelete,
  onAnexos,
  onStatusChange,
  canEdit,
  canDelete
}) => {
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  return (
    <div className="space-y-3">
      {agendamentos.map((agendamento) => (
        <Card key={agendamento.id} className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <h4 className="font-semibold text-lg">{agendamento.nome_colaborador}</h4>
              <p className="text-sm text-muted-foreground">{agendamento.funcao}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => onView(agendamento.id)} title="Visualizar">
                <Eye className="h-4 w-4" />
              </Button>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => onEdit(agendamento.id)} title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => onAnexos(agendamento.id)} title="Anexos">
                <Paperclip className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(agendamento.id)}
                  title="Excluir"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(agendamento.data_agendamento)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatTime(agendamento.horario_agendamento)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{agendamento.empresa}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{agendamento.bd_locais_atendimento?.nome_local || '-'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="outline">{agendamento.tipo_exame}</Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <Badge variant={getStatusColor(agendamento.status)}>
                    {agendamento.status}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUS_AGENDAMENTO.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => onStatusChange(agendamento.id, status)}
                    disabled={!canEdit}
                  >
                    <Badge variant={getStatusColor(status)} className="mr-2">
                      {status}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
      ))}
    </div>
  );
};
