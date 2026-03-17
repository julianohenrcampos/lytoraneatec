import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, XCircle } from 'lucide-react';
import { Desligamento, getStatusDesligamentoColor, getStatusDesligamentoLabel, getTipoDesligamentoLabel } from '@/types/desligamento';

interface Props {
  desligamentos: Desligamento[];
  onView: (d: Desligamento) => void;
  onCancel: (d: Desligamento) => void;
}

export const DesligamentoList: React.FC<Props> = ({ desligamentos, onView, onCancel }) => {
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Funcionário</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Data Efetiva</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Recontratável</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {desligamentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Nenhum desligamento registrado
              </TableCell>
            </TableRow>
          ) : (
            desligamentos.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.bd_funcionarios?.nome_completo || '—'}</TableCell>
                <TableCell>{d.bd_funcionarios?.bd_funcoes?.nome_funcao || '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{getTipoDesligamentoLabel(d.tipo_desligamento as any)}</Badge>
                </TableCell>
                <TableCell className="max-w-[150px] truncate">{d.motivo || '—'}</TableCell>
                <TableCell>{formatDate(d.data_efetiva_desligamento)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusDesligamentoColor(d.status as any)}>
                    {getStatusDesligamentoLabel(d.status as any)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {d.recontratavel ? (
                    <Badge variant="success">Sim</Badge>
                  ) : (
                    <Badge variant="destructive">Não</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(d)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {d.status === 'em_andamento' && (
                      <Button variant="ghost" size="icon" onClick={() => onCancel(d)}>
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
