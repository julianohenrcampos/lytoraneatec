import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AgendamentoExame, getStatusColor, STATUS_AGENDAMENTO } from '@/types/ssoAgendamentoExames';
import { Eye, Pencil, Trash2, Paperclip, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { AgendamentoExamesMobileCards } from './AgendamentoExamesMobileCards';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendamentoExamesTableProps {
  agendamentos: AgendamentoExame[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAnexos: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export const AgendamentoExamesTable: React.FC<AgendamentoExamesTableProps> = ({
  agendamentos,
  onView,
  onEdit,
  onDelete,
  onAnexos,
  onStatusChange,
  canEdit,
  canDelete
}) => {
  const isMobile = useIsMobile();

  if (agendamentos.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Nenhum agendamento encontrado.</p>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <AgendamentoExamesMobileCards
        agendamentos={agendamentos}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onAnexos={onAnexos}
        onStatusChange={onStatusChange}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    // Remove seconds if present
    return timeStr.substring(0, 5);
  };

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Tipo Exame</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agendamentos.map((agendamento) => (
            <TableRow key={agendamento.id}>
              <TableCell>{formatDate(agendamento.data_agendamento)}</TableCell>
              <TableCell>{formatTime(agendamento.horario_agendamento)}</TableCell>
              <TableCell className="font-medium">{agendamento.nome_colaborador}</TableCell>
              <TableCell>{agendamento.cpf || '-'}</TableCell>
              <TableCell>{agendamento.empresa}</TableCell>
              <TableCell>{agendamento.tipo_exame}</TableCell>
              <TableCell>{agendamento.bd_locais_atendimento?.nome_local || '-'}</TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
