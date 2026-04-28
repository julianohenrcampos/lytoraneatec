import React, { useState } from 'react';
import { usePageTitle } from "@/contexts/PageTitleContext";
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { SSODesvioFiltersComponent, SSODesvioTable } from '@/components/ssoDesvios/list';
import { SSODesvioDialog, SSODesvioViewDialog } from '@/components/ssoDesvios/dialog';
import { useSSODesvio } from '@/hooks/ssoDesvios/useSSODesvio';
import { SSODesvioFilters } from '@/types/ssoDesvios';
import { usePermission } from '@/hooks/usePermission';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, BarChart3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SSODesviosList() {
  usePageTitle("Registro de Desvios – SSO");
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SSODesvioFilters>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDesvioId, setSelectedDesvioId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [desvioToDelete, setDesvioToDelete] = useState<string | null>(null);

  const { desvios, isLoading, deleteDesvio, isDeleting } = useSSODesvio(undefined, filters);
  const { isSuperAdmin, userId, hasActionPermission } = usePermission();

  const canEditAll = isSuperAdmin || hasActionPermission('acesso_sso_desvios', 'editar');
  const canDeleteAll = isSuperAdmin || hasActionPermission('acesso_sso_desvios', 'excluir');

  const handleFilterChange = (newFilters: SSODesvioFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleView = (id: string) => {
    setSelectedDesvioId(id);
    setViewDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setSelectedDesvioId(id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDesvioToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (desvioToDelete) {
      await deleteDesvio(desvioToDelete);
      setDeleteDialogOpen(false);
      setDesvioToDelete(null);
    }
  };

  const handleNewDesvio = () => {
    setSelectedDesvioId(undefined);
    setDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/sso/checklists/dashboard')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button onClick={handleNewDesvio}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <SSODesvioFiltersComponent
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Tabela */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <SSODesvioTable
            desvios={desvios}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canEditAll={canEditAll}
            canDeleteAll={canDeleteAll}
            currentUserId={userId}
          />
        )}

        {/* Dialogs */}
        <SSODesvioDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          desvioId={selectedDesvioId}
        />

        {selectedDesvioId && (
          <SSODesvioViewDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            desvioId={selectedDesvioId}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este registro de desvio? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
