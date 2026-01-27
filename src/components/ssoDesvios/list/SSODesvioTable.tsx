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
import { SSODesvio, getClassificacaoColor } from '@/types/ssoDesvios';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SSODesvioMobileCards } from './SSODesvioMobileCards';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/table-pagination';

interface SSODesvioTableProps {
  desvios: SSODesvio[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canEditAll: boolean;
  canDeleteAll: boolean;
  currentUserId?: string;
}

export const SSODesvioTable: React.FC<SSODesvioTableProps> = ({
  desvios,
  onView,
  onEdit,
  onDelete,
  canEditAll,
  canDeleteAll,
  currentUserId
}) => {
  const isMobile = useIsMobile();
  const pagination = usePagination(desvios, { pageSize: 10 });

  if (desvios.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Nenhum registro de desvio encontrado.</p>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <SSODesvioMobileCards
        desvios={desvios}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        canEditAll={canEditAll}
        canDeleteAll={canDeleteAll}
        currentUserId={currentUserId}
      />
    );
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Relatório</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Eng. da Obra</TableHead>
              <TableHead>Téc. Segurança</TableHead>
              <TableHead>Tipo de Desvio</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((desvio) => {
              const canEditThis = canEditAll || desvio.criado_por === currentUserId;
              const canDeleteThis = canDeleteAll;
              const isEncerrado = desvio.status_acao === 'Encerrado';

              return (
                <TableRow key={desvio.id}>
                  <TableCell className="font-mono text-xs">
                    {desvio.numero_relatorio}
                  </TableCell>
                  <TableCell>
                    <span className="max-w-[200px] truncate block" title={desvio.bd_centros_custo?.nome_centro_custo}>
                      {desvio.bd_centros_custo?.nome_centro_custo || '-'}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDate(desvio.data_registro)}
                  </TableCell>
                  <TableCell>{desvio.engenheiro_obra}</TableCell>
                  <TableCell>{desvio.tecnico_seguranca}</TableCell>
                  <TableCell>
                    <span className="max-w-[150px] truncate block" title={desvio.tipos_desvio?.join(', ')}>
                      {desvio.tipos_desvio?.length > 0 ? desvio.tipos_desvio[0] : '-'}
                      {desvio.tipos_desvio?.length > 1 && ` (+${desvio.tipos_desvio.length - 1})`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getClassificacaoColor(desvio.classificacao_desvio)}>
                      {desvio.classificacao_desvio}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(desvio.id)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditThis && !isEncerrado && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(desvio.id)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteThis && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(desvio.id)}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {desvios.length > 0 && (
        <TablePagination pagination={pagination} className="p-4 border-t" />
      )}
    </Card>
  );
};
