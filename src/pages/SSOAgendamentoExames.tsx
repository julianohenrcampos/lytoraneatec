import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { AgendamentoExamesFilters, AgendamentoExamesTable } from '@/components/ssoAgendamentoExames/list';
import { BulkActionBar } from '@/components/ssoAgendamentoExames/list/BulkActionBar';
import { AgendamentoExamesDialog, AgendamentoExamesViewDialog } from '@/components/ssoAgendamentoExames/dialog';
import { useAgendamentoExames } from '@/hooks/ssoAgendamentoExames';
import { AgendamentoExameFilters } from '@/types/ssoAgendamentoExames';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { Plus, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const SSOAgendamentoExames: React.FC = () => {
  const [filters, setFilters] = useState<AgendamentoExameFilters>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { 
    agendamentos, 
    isLoading, 
    delete: deleteAgendamento, 
    updateStatus, 
    updateStatusBulk,
    isDeleting,
    isUpdatingStatusBulk 
  } = useAgendamentoExames(undefined, filters);
  const { isSuperAdmin, userRole } = useAuthPermissions();

  const canEdit = isSuperAdmin || ['SuperAdm', 'Admin', 'AdmRH', 'AdmSSO'].includes(userRole || '');
  const canDelete = isSuperAdmin || ['SuperAdm', 'Admin', 'AdmRH'].includes(userRole || '');

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [filters]);

  const handleNew = () => {
    setEditingId(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleView = (id: string) => {
    setViewingId(id);
    setViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAgendamento(deleteId);
      setDeleteId(null);
      setSelectedIds(prev => prev.filter(id => id !== deleteId));
    } catch (error) {
      console.error('Erro ao excluir:', error);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus({ id, status });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      await updateStatusBulk({ ids: selectedIds, status });
      setSelectedIds([]);
    } catch (error) {
      console.error('Erro ao atualizar status em massa:', error);
    }
  };

  const handleExportExcel = () => {
    if (agendamentos.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }
    const data = agendamentos.map(a => ({
      'Empresa': a.empresa,
      'Contrato/Obra': a.contrato || '',
      'Colaborador': a.nome_colaborador,
      'Função': a.funcao,
      'Data Nascimento': a.data_nascimento ? format(new Date(a.data_nascimento), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'RG': a.rg || '',
      'CPF': a.cpf || '',
      'Tipo Exame': a.tipo_exame,
      'Local': a.bd_locais_atendimento?.nome_local || '',
      'Data Agendamento': format(new Date(a.data_agendamento), 'dd/MM/yyyy', { locale: ptBR }),
      'Hora': a.horario_agendamento.substring(0, 5),
      'Status': a.status,
      'Responsável': a.tecnico_seguranca || '',
      'Docs Anexados': a.documentos_anexados ? 'Sim' : 'Não',
      'Observações': a.observacoes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `agendamentos_exames_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Arquivo exportado com sucesso!');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agendamento de Exames</h1>
            <p className="text-muted-foreground">Gerencie os agendamentos de exames ocupacionais</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            {canEdit && (
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AgendamentoExamesFilters
          onFilterChange={setFilters}
          onClearFilters={() => setFilters({})}
        />

        {/* Bulk Action Bar */}
        {canEdit && (
          <BulkActionBar
            selectedCount={selectedIds.length}
            onStatusChange={handleBulkStatusChange}
            onClearSelection={() => setSelectedIds([])}
            isLoading={isUpdatingStatusBulk}
          />
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <AgendamentoExamesTable
            agendamentos={agendamentos}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteId(id)}
            onAnexos={() => toast.info('Funcionalidade de anexos em desenvolvimento')}
            onStatusChange={handleStatusChange}
            canEdit={canEdit}
            canDelete={canDelete}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        )}

        {/* Edit Dialog */}
        <AgendamentoExamesDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          agendamentoId={editingId}
        />

        {/* View Dialog */}
        <AgendamentoExamesViewDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          agendamentoId={viewingId}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.
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

export default SSOAgendamentoExames;
