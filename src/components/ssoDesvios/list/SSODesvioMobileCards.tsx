import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SSODesvio, getClassificacaoColor, getStatusColor } from '@/types/ssoDesvios';
import { Eye, Pencil, Trash2, Calendar, Building2, User, AlertTriangle } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';

interface SSODesvioMobileCardsProps {
  desvios: SSODesvio[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  canEditAll: boolean;
  canDeleteAll: boolean;
  currentUserId?: string;
}

export const SSODesvioMobileCards: React.FC<SSODesvioMobileCardsProps> = ({
  desvios,
  onView,
  onEdit,
  onDelete,
  canEditAll,
  canDeleteAll,
  currentUserId
}) => {
  const { paginatedData, currentPage, totalPages, setPage } = usePagination(desvios, { pageSize: 5 });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-4">
      {paginatedData.map((desvio) => {
        const canEditThis = canEditAll || desvio.criado_por === currentUserId;
        const canDeleteThis = canDeleteAll;
        const isEncerrado = desvio.status_acao === 'Encerrado';

        return (
          <Card key={desvio.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {formatDate(desvio.data_registro)}
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {desvio.numero_relatorio}
                </p>
              </div>
              <div className="flex gap-1">
                <Badge className={getClassificacaoColor(desvio.classificacao_desvio)}>
                  {desvio.classificacao_desvio}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">
                  {desvio.bd_centros_custo?.nome_centro_custo || '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{desvio.tecnico_seguranca}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">
                  {desvio.tipos_desvio?.length > 0 ? desvio.tipos_desvio[0] : '-'}
                  {desvio.tipos_desvio?.length > 1 && ` (+${desvio.tipos_desvio.length - 1})`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Badge className={getStatusColor(desvio.status_acao)}>
                {desvio.status_acao}
              </Badge>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(desvio.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {canEditThis && !isEncerrado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(desvio.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDeleteThis && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(desvio.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            Anterior
          </Button>
          <span className="flex items-center px-3 text-sm">
            {currentPage + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
};
