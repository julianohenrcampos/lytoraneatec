import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { UserMinus, Plus, Search, Loader2 } from 'lucide-react';
import { useDesligamentos } from '@/hooks/useDesligamentos';
import { DesligamentoDialog } from '@/components/desligamento/DesligamentoDialog';
import { DesligamentoList } from '@/components/desligamento/DesligamentoList';
import { DesligamentoDetailsDialog } from '@/components/desligamento/DesligamentoDetailsDialog';
import { Desligamento, DesligamentoFormData, StatusDesligamento } from '@/types/desligamento';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const GestaoDesligamentos = () => {
  const { desligamentos, isLoading, createDesligamento, cancelDesligamento } = useDesligamentos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDesligamento, setSelectedDesligamento] = useState<Desligamento | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Desligamento | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterSearch, setFilterSearch] = useState('');

  const filtered = useMemo(() => {
    let list = desligamentos;
    if (filterStatus !== 'todos') {
      list = list.filter(d => d.status === filterStatus);
    }
    if (filterSearch.trim()) {
      const term = filterSearch.toLowerCase();
      list = list.filter(d => d.bd_funcionarios?.nome_completo?.toLowerCase().includes(term));
    }
    return list;
  }, [desligamentos, filterStatus, filterSearch]);

  const handleCreate = (data: DesligamentoFormData) => {
    createDesligamento.mutate(data, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelDesligamento.mutate(
      { id: cancelTarget.id, funcionario_id: cancelTarget.funcionario_id },
      { onSuccess: () => setCancelTarget(null) },
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserMinus className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Gestão de Desligamentos</h1>
            <p className="text-sm text-muted-foreground">Controle de desligamentos e aviso prévio</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Desligamento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <DesligamentoList
          desligamentos={filtered}
          onView={d => { setSelectedDesligamento(d); setDetailsOpen(true); }}
          onCancel={d => setCancelTarget(d)}
        />
      )}

      {/* Dialogs */}
      <DesligamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        isSubmitting={createDesligamento.isPending}
      />

      <DesligamentoDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        desligamento={selectedDesligamento}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Desligamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O funcionário <strong>{cancelTarget?.bd_funcionarios?.nome_completo}</strong> será reativado. Esta ação pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Confirmar Cancelamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestaoDesligamentos;
