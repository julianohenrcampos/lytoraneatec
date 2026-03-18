import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, Trash2, CheckCircle, Image, ImageOff } from 'lucide-react';
import { VerAgir, getStatusColor, getStatusLabel } from '@/types/ssoVerAgir';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { VerAgirMobileCards } from './VerAgirMobileCards';

interface VerAgirTableProps {
  registros: VerAgir[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onConcluir: (id: string) => void;
  canEditAll: boolean;
  canDeleteAll: boolean;
  canConcluir: boolean;
  currentUserId?: string | null;
}

export const VerAgirTable: React.FC<VerAgirTableProps> = ({
  registros,
  onView,
  onEdit,
  onDelete,
  onConcluir,
  canEditAll,
  canDeleteAll,
  canConcluir,
  currentUserId
}) => {
  const isMobile = useIsMobile();

  const canEditRecord = (registro: VerAgir) => {
    if (canEditAll) return true;
    return registro.criado_por === currentUserId && ['RASCUNHO', 'ENVIADO'].includes(registro.status);
  };

  const canDeleteRecord = (registro: VerAgir) => {
    if (canDeleteAll) return true;
    return registro.criado_por === currentUserId && registro.status === 'RASCUNHO';
  };

  const canConcluirRecord = (registro: VerAgir) => {
    if (!canConcluir) return false;
    return registro.status !== 'CONCLUIDO';
  };

  if (isMobile) {
    return (
      <VerAgirMobileCards
        registros={registros}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onConcluir={onConcluir}
        canEditAll={canEditAll}
        canDeleteAll={canDeleteAll}
        canConcluir={canConcluir}
        currentUserId={currentUserId}
      />
    );
  }

  if (registros.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ImageOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum registro encontrado</p>
        <p className="text-sm">Crie um novo registro para começar.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Obra</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Evidências</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registros.map((registro) => (
            <TableRow key={registro.id}>
              <TableCell>
                {format(new Date(registro.data_registro), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
              <TableCell>{registro.hora_registro?.slice(0, 5)}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={registro.obra}>
                {registro.obra}
              </TableCell>
              <TableCell className="max-w-[150px] truncate" title={registro.local}>
                {registro.local}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(registro.status)}>
                  {getStatusLabel(registro.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center gap-1">
                  <span title={registro.foto_antes_url ? 'Foto ANTES enviada' : 'Sem foto ANTES'}>
                    {registro.foto_antes_url ? (
                      <Image className="h-4 w-4 text-green-600" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-gray-400" />
                    )}
                  </span>
                  <span title={registro.foto_depois_url ? 'Foto DEPOIS enviada' : 'Sem foto DEPOIS'}>
                    {registro.foto_depois_url ? (
                      <Image className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-gray-400" />
                    )}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="outline" size="icon" onClick={() => onView(registro.id)} title="Visualizar">
                  <Eye className="h-4 w-4" />
                </Button>
                {canEditRecord(registro) && (
                  <Button variant="outline" size="icon" onClick={() => onEdit(registro.id)} title="Editar">
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {canConcluirRecord(registro) && (
                  <Button variant="outline" size="icon" onClick={() => onConcluir(registro.id)} title="Concluir">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                {canDeleteRecord(registro) && (
                  <Button variant="outline" size="icon" onClick={() => onDelete(registro.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
