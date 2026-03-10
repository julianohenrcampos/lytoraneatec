import React, { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ClinicaDialog, ClinicasTable } from '@/components/ssoClinicas';
import { useLocaisAtendimento } from '@/hooks/ssoAgendamentoExames';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { Plus, Loader2, Building2 } from 'lucide-react';
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

const SSOClinicas: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { locais, isLoading, delete: deleteClinica, toggleAtivo, isDeleting } = useLocaisAtendimento();
  const { isSuperAdmin, userRole } = useAuthPermissions();

  const canCreate = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA', 'TecEnferSSO', 'AdmtreinoSSO'].includes(userRole || '');
  const canEdit = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA', 'TecEnferSSO', 'AdmtreinoSSO'].includes(userRole || '');
  const canDelete = isSuperAdmin || ['SuperAdm', 'AdmSSO', 'AdmOBRA', 'AdmtreinoSSO'].includes(userRole || '');

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteClinica(deleteId);
      setDeleteId(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      await toggleAtivo({ id, ativo });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Clínicas / Locais de Atendimento
            </h1>
            <p className="text-muted-foreground">
              Gerencie as clínicas disponíveis para agendamento de exames
            </p>
          </div>
          {canCreate && (
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Clínica
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <ClinicasTable
            clinicas={locais}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteId(id)}
            onToggleAtivo={handleToggleAtivo}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {/* Dialog */}
        <ClinicaDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          clinicaId={editingId}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta clínica? 
                Esta ação não pode ser desfeita e pode afetar agendamentos existentes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default SSOClinicas;
