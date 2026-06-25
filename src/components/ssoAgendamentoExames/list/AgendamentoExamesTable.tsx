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
import { 
  AgendamentoExame, 
  getStatusColor, 
  STATUS_AGENDAMENTO,
  getStatusIntegracoColor,
  STATUS_INTEGRACAO,
  STATUS_CARTEIRA,
  getStatusCarteiraColor,
  getStatusCarteiraLabel,
  isPrazoVencido
} from '@/types/ssoAgendamentoExames';
import { Eye, Pencil, Trash2, Paperclip, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { AgendamentoExamesMobileCards } from './AgendamentoExamesMobileCards';
import { PrazoContratacaoProgress } from './PrazoContratacaoProgress';
import { BeneficiosVtVrCell } from './BeneficiosVtVrCell';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/table-pagination';
import { cn } from '@/lib/utils';

interface AgendamentoExamesTableProps {
  agendamentos: AgendamentoExame[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAnexos: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onIntegracoChange?: (id: string, status: string) => void;
  onCarteiraChange?: (id: string, status: string) => void;
  onBeneficioUpdate?: (id: string, field: string, value: string | null) => void;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  canChangeStatusExame?: boolean;
  canChangeIntegracao?: boolean;
  canChangeBeneficios?: boolean;
  canChangeCarteira?: boolean;
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
  onIntegracoChange,
  onCarteiraChange,
  onBeneficioUpdate,
  canEdit,
  canDelete,
  canChangeStatus,
  canChangeStatusExame,
  canChangeIntegracao,
  canChangeBeneficios,
  canChangeCarteira,
  selectedIds,
  onSelectionChange,
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


  // Helper para verificar se exibe campos de contratação (Admissional ou Mudança de Risco)
  const showHiringFields = (tipoExame: string) => tipoExame === 'Admissional' || tipoExame === 'Mudança de Risco';

  // Função para verificar se a linha está irregular (apenas para Admissional)
  const getRowClassName = (agendamento: AgendamentoExame) => {
    const statusCart = agendamento.status_carteira || 'Pendente';
    const isHiring = showHiringFields(agendamento.tipo_exame);
    const vencido = isHiring && isPrazoVencido(agendamento.data_registro_carteira, statusCart);
    if (statusCart === 'Desistencia') {
      return 'bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50';
    }
    if (vencido) {
      return 'bg-destructive/10 hover:bg-destructive/15 border-l-4 border-l-destructive';
    }
    if (selectedIds.includes(agendamento.id)) {
      return 'bg-muted/50';
    }
    return '';
  };

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
            <TableHead>Data Agend.</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Tipo Exame</TableHead>
            <TableHead>Status Exame</TableHead>
            <TableHead>Integração</TableHead>
            <TableHead className="text-center">Benefícios (VT/VR)</TableHead>
            <TableHead className="text-center">Prazo Contrat.</TableHead>
            <TableHead>Status Carteira</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.paginatedData.map((agendamento) => (
            <TableRow key={agendamento.id} className={cn(getRowClassName(agendamento))}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(agendamento.id)}
                  onCheckedChange={(checked) => handleSelectOne(agendamento.id, checked as boolean)}
                  aria-label={`Selecionar ${agendamento.nome_colaborador}`}
                />
              </TableCell>
              <TableCell>{formatBrazilianDateForDisplay(agendamento.data_agendamento)}</TableCell>
              <TableCell className="font-medium max-w-[180px] truncate" title={agendamento.nome_colaborador}>
                {agendamento.nome_colaborador}
              </TableCell>
              <TableCell>
                {agendamento.motivo_contratacao ? (
                  <Badge variant="outline" className="text-xs">
                    {agendamento.motivo_contratacao === 'Nova Contratação' ? 'Nova Contr.' : 'Subst.'}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
              </TableCell>
              <TableCell>
                {canChangeStatusExame ? (
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
                        >
                          <Badge variant={getStatusColor(status)} className="mr-2">
                            {status}
                          </Badge>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Badge variant={getStatusColor(agendamento.status)}>
                    {agendamento.status}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {showHiringFields(agendamento.tipo_exame) ? (
                  canChangeIntegracao && onIntegracoChange ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          <Badge variant={getStatusIntegracoColor(agendamento.status_integracao)}>
                            {agendamento.status_integracao}
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Badge>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {STATUS_INTEGRACAO.map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => onIntegracoChange(agendamento.id, status)}
                          >
                            <Badge variant={getStatusIntegracoColor(status)} className="mr-2">
                              {status}
                            </Badge>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge variant={getStatusIntegracoColor(agendamento.status_integracao)}>
                      {agendamento.status_integracao}
                    </Badge>
                  )
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {showHiringFields(agendamento.tipo_exame) && onBeneficioUpdate ? (
                  <BeneficiosVtVrCell
                    agendamento={agendamento}
                    onBeneficioUpdate={onBeneficioUpdate}
                    canEdit={!!canChangeBeneficios}
                  />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {showHiringFields(agendamento.tipo_exame) ? (
                  <PrazoContratacaoProgress
                    dataResultado={agendamento.data_resultado_exame}
                    statusExame={agendamento.status}
                    statusCarteira={agendamento.status_carteira || 'Pendente'}
                  />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {showHiringFields(agendamento.tipo_exame) ? (
                  canChangeCarteira && onCarteiraChange ? (
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-auto">
                        <Badge 
                          variant={
                            isPrazoVencido(agendamento.data_registro_carteira, agendamento.status_carteira || 'Pendente') 
                              ? 'destructive' 
                              : getStatusCarteiraColor(agendamento.status_carteira || 'Pendente')
                          }
                        >
                          {isPrazoVencido(agendamento.data_registro_carteira, agendamento.status_carteira || 'Pendente') 
                            ? 'IRREGULAR' 
                            : getStatusCarteiraLabel(agendamento.status_carteira || 'Pendente')
                          }
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {STATUS_CARTEIRA.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => onCarteiraChange(agendamento.id, status)}
                        >
                          <Badge
                            variant={getStatusCarteiraColor(status)}
                            className={cn(
                              'mr-2',
                              status === 'Desistencia' && 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300'
                            )}
                          >
                            {getStatusCarteiraLabel(status)}
                          </Badge>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  ) : (
                    <Badge 
                      variant={
                        isPrazoVencido(agendamento.data_registro_carteira, agendamento.status_carteira || 'Pendente') 
                          ? 'destructive' 
                          : getStatusCarteiraColor(agendamento.status_carteira || 'Pendente')
                      }
                    >
                      {isPrazoVencido(agendamento.data_registro_carteira, agendamento.status_carteira || 'Pendente') 
                        ? 'IRREGULAR' 
                        : getStatusCarteiraLabel(agendamento.status_carteira || 'Pendente')
                      }
                    </Badge>
                  )
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
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
