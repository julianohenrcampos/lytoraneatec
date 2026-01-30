import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/table-pagination';

interface AgendamentoExamesTableProps {
  agendamentos: AgendamentoExame[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAnexos: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export const AgendamentoExamesTable: React.FC<AgendamentoExamesTableProps> = ({
  agendamentos,
  onView,
  onEdit,
  onDelete,
  onAnexos,
  onStatusChange,
  canEdit,
  canDelete,
  canChangeStatus,
  selectedIds,
  onSelectionChange
}) => {
  const isMobile = useIsMobile();
  const pagination = usePagination(agendamentos, { pageSize: 10 });

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
        canChangeStatus={canChangeStatus}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  const formatTime = (timeStr: string) => {
    // Remove seconds if present
    return timeStr.substring(0, 5);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(pagination.paginatedData.map(a => a.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const isAllSelected = pagination.paginatedData.length > 0 && 
    pagination.paginatedData.every(a => selectedIds.includes(a.id));
  const isIndeterminate = pagination.paginatedData.some(a => selectedIds.includes(a.id)) && 
    !pagination.paginatedData.every(a => selectedIds.includes(a.id));

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isAllSelected}
                ref={(ref) => {
                  if (ref) {
                    (ref as any).indeterminate = isIndeterminate;
                  }
                }}
                onCheckedChange={handleSelectAll}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead>Data/Agendamento</TableHead>
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
          {pagination.paginatedData.map((agendamento) => (
            <TableRow key={agendamento.id} className={selectedIds.includes(agendamento.id) ? 'bg-muted/50' : ''}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(agendamento.id)}
                  onCheckedChange={(checked) => handleSelectOne(agendamento.id, checked as boolean)}
                  aria-label={`Selecionar ${agendamento.nome_colaborador}`}
                />
              </TableCell>
              <TableCell>{formatBrazilianDateForDisplay(agendamento.data_agendamento)}</TableCell>
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
                        disabled={!canChangeStatus}
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
      {agendamentos.length > 0 && (
        <TablePagination pagination={pagination} className="p-4 border-t" />
      )}
    </Card>
  );
};
