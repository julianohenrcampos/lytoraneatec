import React, { useState } from 'react';
import { usePageTitle } from "@/contexts/PageTitleContext";
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { VerAgirFiltersComponent, VerAgirTable } from '@/components/ssoVerAgir/list';
import { VerAgirDialog, VerAgirViewDialog } from '@/components/ssoVerAgir/dialog';
import { useVerAgir } from '@/hooks/ssoVerAgir';
import { VerAgirFilters } from '@/types/ssoVerAgir';
import { usePermission } from '@/hooks/usePermission';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, BarChart3, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function SSOVerAgir() {
  usePageTitle("Ver e Agir - Não Conformidade");
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
  const { isSuperAdmin, userId, hasActionPermission } = usePermission();

  const canEditAll = isSuperAdmin || hasActionPermission('acesso_sso_ver_agir', 'editar');
  const canDeleteAll = isSuperAdmin || hasActionPermission('acesso_sso_ver_agir', 'excluir');
  const canConcluir = isSuperAdmin || hasActionPermission('acesso_sso_ver_agir', 'aprovar');

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
    // Espelha VerAgirTable: canEditAll || (criado_por === currentUserId && status ∈ {RASCUNHO, ENVIADO})
    const registro = registros.find(r => r.id === id);
    const isOwnerEdit = !!registro && !!userId
      && registro.criado_por === userId
      && ['RASCUNHO', 'ENVIADO'].includes(registro.status);
    if (!isSuperAdmin && !canEditAll && !isOwnerEdit) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    setSelectedRegistroId(id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setRegistroToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    // Espelha VerAgirTable: canDeleteAll || (criado_por === currentUserId && status === 'RASCUNHO')
    const registro = registros.find(r => r.id === registroToDelete);
    const isOwnerDelete = !!registro && !!userId
      && registro.criado_por === userId
      && registro.status === 'RASCUNHO';
    if (!isSuperAdmin && !canDeleteAll && !isOwnerDelete) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
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
    if (!isSuperAdmin && !canConcluir) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
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
          <div></div>
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
