import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useSSOChecklist } from '@/hooks/sso/useSSOChecklist';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { Button } from '@/components/ui/button';
import { Plus, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SSOChecklistFilters } from '@/components/sso/list/SSOChecklistFilters';
import { SSOChecklistTable } from '@/components/sso/list/SSOChecklistTable';
import { SSOChecklistDialog } from '@/components/sso/dialog/SSOChecklistDialog';
import { SSOChecklistViewDialog } from '@/components/sso/dialog/SSOChecklistViewDialog';
import { SSOChecklist, SSOChecklistFilters as FilterType } from '@/types/sso';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const SSOChecklistList = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, userRole } = useAuthPermissions();
  const [filters, setFilters] = useState<FilterType>({});
  const { checklists, isLoading, deleteChecklist } = useSSOChecklist(undefined, filters);
  
  // Verificar se usuário pode editar (SuperAdm ou AdmSSO)
  const canEdit = isSuperAdmin || userRole === 'AdmSSO';
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<SSOChecklist | null>(null);

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

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">SSO - Checklists NR-18</h1>
            <p className="text-muted-foreground">
              Inspeções de Saúde e Segurança Ocupacional
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/sso/checklists/dashboard')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Checklist
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <SSOChecklistFilters
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Tabela */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando checklists...</p>
          </div>
        ) : (
          <SSOChecklistTable
            checklists={checklists}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            canEdit={canEdit}
          />
        )}

        {/* Dialog de Visualização - Apenas Não Conformidades */}
        <SSOChecklistViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          checklistId={selectedChecklistId}
        />

        {/* Dialog de Edição */}
        <SSOChecklistDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          checklistId={selectedChecklistId}
        />

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
    </MainLayout>
  );
};

export default SSOChecklistList;
