import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { SSOChecklist } from '@/types/sso';
import { ssoCalculations } from '@/utils/sso/ssoCalculations';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { SSOChecklistMobileCards } from './SSOChecklistMobileCards';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/table-pagination';

interface SSOChecklistTableProps {
  checklists: SSOChecklist[];
  onView: (checklist: SSOChecklist) => void;
  onEdit: (checklist: SSOChecklist) => void;
  onDelete: (checklist: SSOChecklist) => void;
  canEditAll?: boolean;
  canDeleteAll?: boolean;
  currentUserId?: string;
}

export const SSOChecklistTable = ({ 
  checklists, 
  onView, 
  onEdit, 
  onDelete, 
  canEditAll = false,
  canDeleteAll = false,
  currentUserId
}: SSOChecklistTableProps) => {
  const isMobile = useIsMobile();
  const pagination = usePagination(checklists, { pageSize: 10 });

  if (checklists.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Nenhum checklist encontrado</p>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <SSOChecklistMobileCards
        checklists={checklists}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        canEditAll={canEditAll}
        canDeleteAll={canDeleteAll}
        currentUserId={currentUserId}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Data</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Obra</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Etapa</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Téc. Segurança</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Nota Real</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Resultado</th>
              <th className="px-4 py-3 text-center text-sm font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagination.paginatedData.map((checklist) => {
              // TecSSO pode editar apenas seus próprios checklists
              const canEditThis = canEditAll || checklist.criado_por === currentUserId;
              // Apenas SuperAdm/AdmSSO podem excluir
              const canDeleteThis = canDeleteAll;

              return (
                <tr key={checklist.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm">
                    {formatBrazilianDateForDisplay(checklist.data_inspecao)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {checklist.bd_centros_custo?.nome_centro_custo || '-'}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-muted">
                      {checklist.etapa_vistoria || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {checklist.tecnico_seguranca || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {checklist.nota_real !== null && checklist.nota_real !== undefined ? (
                      <span className="text-lg font-bold">
                        {checklist.nota_real.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {checklist.resultado_avaliacao && (
                      <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full border ${
                        ssoCalculations.getResultadoColor(checklist.resultado_avaliacao)
                      }`}>
                        {checklist.resultado_avaliacao}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView(checklist)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEditThis && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(checklist)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteThis && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(checklist)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {checklists.length > 0 && (
        <TablePagination pagination={pagination} className="p-4 border-t" />
      )}
    </Card>
  );
};
