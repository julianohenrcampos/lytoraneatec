import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useSSOChecklist } from '@/hooks/sso/useSSOChecklist';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SSOChecklistFilters } from '@/components/sso/list/SSOChecklistFilters';
import { SSOChecklistTable } from '@/components/sso/list/SSOChecklistTable';
import { SSOChecklistDialog } from '@/components/sso/dialog/SSOChecklistDialog';
import { SSOChecklistViewDialog } from '@/components/sso/dialog/SSOChecklistViewDialog';
import { SSOChecklist, SSOChecklistFilters as FilterType } from '@/types/sso';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ssoExportService } from '@/services/sso/ssoExportService';
import { generateSSOExcelFormatted } from '@/lib/ssoExcelExport';
import { toast } from 'sonner';

const SSOChecklistList = () => {
  usePageTitle("CHECK LIST - AUTOS DE INFRAÇÃO MTE_TAC");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isSuperAdmin,
    userRole,
    userId
  } = usePermission();
  const [filters, setFilters] = useState<FilterType>({});
  const {
    checklists,
    isLoading,
    deleteChecklist
  } = useSSOChecklist(undefined, filters);

  // SuperAdm e AdmSSO podem editar/excluir todos os checklists e exportar Excel
  const canEditAll = isSuperAdmin || userRole === 'AdmSSO';
  const canDeleteAll = isSuperAdmin || userRole === 'AdmSSO';
  const canExportExcel = isSuperAdmin || userRole === 'AdmSSO';
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<SSOChecklist | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Abrir dialog de visualização automaticamente via query param (notificações)
  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId) {
      setSelectedChecklistId(viewId);
      setViewDialogOpen(true);
      // Limpar o param da URL após abrir
      searchParams.delete('view');
      setSearchParams(searchParams, {
        replace: true
      });
    }
  }, [searchParams, setSearchParams]);
  const handleFilterChange = (newFilters: FilterType) => {
    setFilters(newFilters);
  };
  const handleClearFilters = () => {
    setFilters({});
  };
  const handleNew = () => {
    setSelectedChecklistId(undefined);
    setEditDialogOpen(true);
  };
  const handleView = (checklist: SSOChecklist) => {
    setSelectedChecklistId(checklist.id);
    setViewDialogOpen(true);
  };
  const handleEdit = (checklist: SSOChecklist) => {
    setSelectedChecklistId(checklist.id);
    setEditDialogOpen(true);
  };
  const handleDeleteClick = (checklist: SSOChecklist) => {
    setChecklistToDelete(checklist);
    setDeleteDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (checklistToDelete) {
      await deleteChecklist(checklistToDelete.id);
      setDeleteDialogOpen(false);
      setChecklistToDelete(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const data = await ssoExportService.getExportData();
      generateSSOExcelFormatted(data);
      toast.success('Planilha exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar planilha');
    } finally {
      setIsExporting(false);
    }
  };
  return <MainLayout>
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex justify-end gap-2">
            {canExportExcel && (
              <Button 
                variant="outline" 
                onClick={handleExportExcel}
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exportando...' : 'Exportar Excel'}
              </Button>
            )}
            
            <Button variant="outline" onClick={() => navigate('/sso/checklists/dashboard')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Checklist
            </Button>
        </div>

        {/* Filtros */}
        <SSOChecklistFilters onFilterChange={handleFilterChange} onClearFilters={handleClearFilters} />

        {/* Tabela */}
        {isLoading ? <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando checklists...</p>
          </div> : <SSOChecklistTable checklists={checklists} onView={handleView} onEdit={handleEdit} onDelete={handleDeleteClick} canEditAll={canEditAll} canDeleteAll={canDeleteAll} currentUserId={userId} />}

        {/* Dialog de Visualização - Apenas Não Conformidades */}
        <SSOChecklistViewDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} checklistId={selectedChecklistId} />

        {/* Dialog de Edição */}
        <SSOChecklistDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} checklistId={selectedChecklistId} />

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este checklist? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>;
};
export default SSOChecklistList;