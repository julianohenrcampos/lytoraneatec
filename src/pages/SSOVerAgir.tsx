import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { VerAgirFiltersComponent, VerAgirTable } from '@/components/ssoVerAgir/list';
import { VerAgirDialog, VerAgirViewDialog } from '@/components/ssoVerAgir/dialog';
import { useVerAgir } from '@/hooks/ssoVerAgir';
import { VerAgirFilters } from '@/types/ssoVerAgir';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, BarChart3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function SSOVerAgir() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<VerAgirFilters>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRegistroId, setSelectedRegistroId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [registroToDelete, setRegistroToDelete] = useState<string | null>(null);
  const [concluirDialogOpen, setConcluirDialogOpen] = useState(false);
  const [registroToConcluir, setRegistroToConcluir] = useState<string | null>(null);

  const { registros, isLoading, deleteRegistro, setStatus, isDeleting, isChangingStatus } = useVerAgir(undefined, filters);
  const { isSuperAdmin, userRole, userId } = useAuthPermissions();

  const canEditAll = isSuperAdmin || userRole === 'AdmSSO';
  const canDeleteAll = isSuperAdmin || userRole === 'AdmSSO';
  const canConcluir = isSuperAdmin || userRole === 'AdmSSO';

  const handleFilterChange = (newFilters: VerAgirFilters) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleView = (id: string) => {
    setSelectedRegistroId(id);
    setViewDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setSelectedRegistroId(id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setRegistroToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (registroToDelete) {
      await deleteRegistro(registroToDelete);
      setDeleteDialogOpen(false);
      setRegistroToDelete(null);
    }
  };

  const handleConcluir = (id: string) => {
    // Verificar se tem as fotos obrigatórias
    const registro = registros.find(r => r.id === id);
    if (registro) {
      if (!registro.foto_antes_url || !registro.foto_depois_url) {
        toast.error('Para concluir, é necessário ter as fotos ANTES e DEPOIS anexadas.');
        return;
      }
    }
    setRegistroToConcluir(id);
    setConcluirDialogOpen(true);
  };

  const confirmConcluir = async () => {
    if (registroToConcluir) {
      await setStatus({ id: registroToConcluir, status: 'CONCLUIDO' });
      setConcluirDialogOpen(false);
      setRegistroToConcluir(null);
    }
  };

  const handleNewRegistro = () => {
    setSelectedRegistroId(undefined);
    setDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">VER E AGIR - NÃO CONFORMIDADE</h1>
            <p className="text-muted-foreground">
              Registro de não conformidades com evidências e ação corretiva
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/sso/checklists/dashboard')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button onClick={handleNewRegistro}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <VerAgirFiltersComponent
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Tabela */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <VerAgirTable
            registros={registros}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onConcluir={handleConcluir}
            canEditAll={canEditAll}
            canDeleteAll={canDeleteAll}
            canConcluir={canConcluir}
            currentUserId={userId}
          />
        )}

        {/* Dialogs */}
        <VerAgirDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          registroId={selectedRegistroId}
        />

        {selectedRegistroId && (
          <VerAgirViewDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            registroId={selectedRegistroId}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
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

        {/* Concluir Confirmation */}
        <AlertDialog open={concluirDialogOpen} onOpenChange={setConcluirDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Conclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Ao concluir este registro, ele não poderá mais ser editado por usuários comuns. 
                Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmConcluir} disabled={isChangingStatus}>
                {isChangingStatus ? 'Concluindo...' : 'Confirmar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
