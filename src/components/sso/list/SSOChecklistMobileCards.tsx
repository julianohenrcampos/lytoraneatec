import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SSOChecklist } from '@/types/sso';
import { ssoCalculations } from '@/utils/sso/ssoCalculations';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { usePagination } from '@/hooks/usePagination';
interface SSOChecklistMobileCardsProps {
  checklists: SSOChecklist[];
  onView: (checklist: SSOChecklist) => void;
  onEdit: (checklist: SSOChecklist) => void;
  onDelete: (checklist: SSOChecklist) => void;
  canEditAll?: boolean;
  canDeleteAll?: boolean;
  currentUserId?: string;
}
export const SSOChecklistMobileCards = ({
  checklists,
  onView,
  onEdit,
  onDelete,
  canEditAll = false,
  canDeleteAll = false,
  currentUserId
}: SSOChecklistMobileCardsProps) => {
  if (checklists.length === 0) {
    return <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm">Nenhum checklist encontrado</p>
      </Card>;
  }
  const {
    paginatedData,
    currentPage,
    totalPages,
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage
  } = usePagination(checklists, {
    pageSize: 5
  });
  return <div className="space-y-3">
      {paginatedData.map(checklist => {
      const canEditThis = canEditAll || checklist.criado_por === currentUserId;
      const canDeleteThis = canDeleteAll;
      return <Card key={checklist.id} className="p-4 space-y-3">
            {/* Header: Data + Resultado */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {formatBrazilianDateForDisplay(checklist.data_inspecao)}
              </span>
              {checklist.resultado_avaliacao && <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${ssoCalculations.getResultadoColor(checklist.resultado_avaliacao)}`}>
                  {checklist.resultado_avaliacao}
                </span>}
            </div>

            {/* Obra - Título principal */}
            <div className="cursor-pointer" onClick={() => onView(checklist)}>
              <h3 className="font-semibold text-foreground leading-tight text-xs">
                {checklist.bd_centros_custo?.nome_centro_custo || '-'}
              </h3>
            </div>

            {/* Técnico de Segurança */}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Téc:</span> {checklist.tecnico_seguranca || '-'}
            </p>

            {/* Nota Real - Formato similar ao Técnico */}
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Nota:</span>{' '}
              {checklist.nota_real !== null && checklist.nota_real !== undefined ? <span className="font-bold text-foreground">{checklist.nota_real.toFixed(2)}</span> : '-'}
            </p>

            {/* Ações */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="ghost" onClick={() => onView(checklist)} className="flex-1">
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
              {canEditThis && <Button size="sm" variant="ghost" onClick={() => onEdit(checklist)} className="flex-1">
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>}
              {canDeleteThis && <Button size="sm" variant="ghost" onClick={() => onDelete(checklist)} className="flex-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>}
            </div>
          </Card>;
    })}

      {/* Paginação Mobile Simplificada */}
      {totalPages > 1 && <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={previousPage} disabled={!canPreviousPage} className="flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage + 1} de {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={nextPage} disabled={!canNextPage} className="flex items-center gap-1">
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>}
    </div>;
};