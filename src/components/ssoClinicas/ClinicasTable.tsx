import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { LocalAtendimento } from '@/types/ssoAgendamentoExames';
import { Pencil, Trash2, MapPin, Phone } from 'lucide-react';

interface ClinicasTableProps {
  clinicas: LocalAtendimento[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const ClinicasTable: React.FC<ClinicasTableProps> = ({
  clinicas,
  onEdit,
  onDelete,
  onToggleAtivo,
  canEdit = true,
  canDelete = true
}) => {
  if (clinicas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <MapPin className="h-12 w-12 mb-4 opacity-50" />
        <p>Nenhuma clínica cadastrada</p>
        <p className="text-sm">Clique em "Nova Clínica" para começar</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome da Clínica</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead className="hidden md:table-cell">Endereço</TableHead>
            <TableHead className="hidden md:table-cell">Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clinicas.map((clinica) => (
            <TableRow key={clinica.id}>
              <TableCell className="font-medium">{clinica.nome_local}</TableCell>
              <TableCell>
                <Badge variant="outline">{clinica.cidade || '-'}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell max-w-xs truncate">
                {clinica.endereco}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {clinica.telefone ? (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {clinica.telefone}
                  </span>
                ) : '-'}
              </TableCell>
              <TableCell>
                <Switch
                  checked={clinica.ativo}
                  onCheckedChange={(checked) => onToggleAtivo(clinica.id, checked)}
                  disabled={!canEdit}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(clinica.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(clinica.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
