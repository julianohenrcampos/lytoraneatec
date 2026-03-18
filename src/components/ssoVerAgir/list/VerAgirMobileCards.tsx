import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, Trash2, CheckCircle, Image, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { VerAgir, getStatusColor, getStatusLabel } from '@/types/ssoVerAgir';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePagination } from '@/hooks/usePagination';

interface VerAgirMobileCardsProps {
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

export const VerAgirMobileCards: React.FC<VerAgirMobileCardsProps> = ({
  registros,
  onView,
  onEdit,
  onDelete,
  onConcluir,
  canEditAll,
  canDeleteAll,
  canConcluir,
  currentUserId,
}) => {
  const { paginatedData, currentPage, totalPages, nextPage, previousPage, canNextPage, canPreviousPage } =
    usePagination(registros, { pageSize: 5 });

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
    <div className="space-y-3">
      {paginatedData.map((registro) => (
        <Card key={registro.id} className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* Header: Data/Hora + Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {format(new Date(registro.data_registro), 'dd/MM/yyyy', { locale: ptBR })} — {registro.hora_registro?.slice(0, 5)}
              </span>
              <Badge className={getStatusColor(registro.status)}>
                {getStatusLabel(registro.status)}
              </Badge>
            </div>

            {/* Obra */}
            <div>
              <span className="text-xs text-muted-foreground">Obra</span>
              <p className="text-sm font-medium truncate" title={registro.obra}>{registro.obra}</p>
            </div>

            {/* Local */}
            <div>
              <span className="text-xs text-muted-foreground">Local</span>
              <p className="text-sm truncate" title={registro.local}>{registro.local}</p>
            </div>

            {/* Evidências */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Evidências:</span>
              <span title={registro.foto_antes_url ? 'Foto ANTES enviada' : 'Sem foto ANTES'} className="flex items-center gap-1">
                {registro.foto_antes_url ? <Image className="h-4 w-4 text-green-600" /> : <ImageOff className="h-4 w-4 text-muted-foreground" />}
                <span className="text-xs">Antes</span>
              </span>
              <span title={registro.foto_depois_url ? 'Foto DEPOIS enviada' : 'Sem foto DEPOIS'} className="flex items-center gap-1">
                {registro.foto_depois_url ? <Image className="h-4 w-4 text-blue-600" /> : <ImageOff className="h-4 w-4 text-muted-foreground" />}
                <span className="text-xs">Depois</span>
              </span>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2 pt-1 border-t">
              <Button variant="outline" size="sm" onClick={() => onView(registro.id)}>
                <Eye className="h-4 w-4 mr-1" /> Ver
              </Button>
              {canEditRecord(registro) && (
                <Button variant="outline" size="sm" onClick={() => onEdit(registro.id)}>
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              {canConcluirRecord(registro) && (
                <Button variant="outline" size="sm" onClick={() => onConcluir(registro.id)}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Concluir
                </Button>
              )}
              {canDeleteRecord(registro) && (
                <Button variant="outline" size="sm" onClick={() => onDelete(registro.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={previousPage} disabled={!canPreviousPage}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={nextPage} disabled={!canNextPage}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};
