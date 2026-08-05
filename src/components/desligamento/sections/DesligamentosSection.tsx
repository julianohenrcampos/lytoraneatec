import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, Filter } from 'lucide-react';
import { useDesligamentos } from '@/hooks/useDesligamentos';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/ui/table-pagination';
import { DesligamentoList } from '@/components/desligamento/DesligamentoList';
import { DesligamentoDetailsDialog } from '@/components/desligamento/DesligamentoDetailsDialog';
import { PdfDesligamentoDialog } from '@/components/desligamento/PdfDesligamentoDialog';
import { Desligamento } from '@/types/desligamento';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePermission } from '@/hooks/usePermission';
import { toast } from 'sonner';
import { gerarPdfSolicitacaoDesligamento } from '@/utils/pdf/gerarPdfSolicitacaoDesligamento';

const DesligamentosSection: React.FC = () => {
  const {
    desligamentos, isLoading,
    aprovarDesligamento, reprovarDesligamento,
    efetivarDesligamento, cancelDesligamento,
  } = useDesligamentos();
  const { isSuperAdmin, hasActionPermission } = usePermission();

  const fallback = (acao: 'visualizar' | 'criar' | 'editar' | 'excluir' | 'aprovar') =>
    hasActionPermission('gestao_rh_funcionarios_view', acao);
  const canEdit =
    isSuperAdmin ||
    hasActionPermission('gestao_rh_desligamentos_view', 'editar') ||
    fallback('editar');
  const canApprove = canEdit;
  const canEffect = canEdit;
  const canCancel = canEdit;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDesligamento, setSelectedDesligamento] = useState<Desligamento | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Desligamento | null>(null);
  const [approveTarget, setApproveTarget] = useState<Desligamento | null>(null);
  const [effectTarget, setEffectTarget] = useState<Desligamento | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Desligamento | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [pdfTarget, setPdfTarget] = useState<Desligamento | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterSearch, setFilterSearch] = useState('');

  const filtered = useMemo(() => {
    let list = desligamentos;
    if (filterStatus !== 'todos') list = list.filter(d => d.status === filterStatus);
    if (filterSearch.trim()) {
      const term = filterSearch.toLowerCase();
      list = list.filter(d => d.bd_funcionarios?.nome_completo?.toLowerCase().includes(term));
    }
    return list;
  }, [desligamentos, filterStatus, filterSearch]);

  const pagination = usePagination(filtered, { pageSize: 10 });

  const handleGerarPdf = (
    d: Desligamento,
    manuais: { valor_rescisao: number | null; data_exame: string | null },
  ) => {
    const f = d.bd_funcionarios;
    if (!f) { toast.error('Dados do funcionário indisponíveis.'); return; }
    gerarPdfSolicitacaoDesligamento({
      protocolo_id: d.id,
      nome: f.nome_completo,
      matricula: f.matricula,
      cpf: f.cpf,
      centro_custo: f.bd_centros_custo
        ? `${f.bd_centros_custo.codigo_centro_custo} - ${f.bd_centros_custo.nome_centro_custo}`
        : '—',
      cargo: f.bd_funcoes?.nome_funcao || '—',
      empresa: f.bd_empresas?.nome_empresa || '—',
      data_admissao: f.data_admissao,
      salario_base: Number(f.salario_base) || 0,
      tipo: d.tipo_desligamento,
      dias_aviso: d.dias_aviso,
      data_efetiva: d.data_efetiva_desligamento,
      data_exame: manuais.data_exame,
      valor_rescisao: manuais.valor_rescisao,
      motivo: d.motivo,
      recontratavel: d.recontratavel,
      observacoes: d.observacoes,
      data_solicitacao: d.data_solicitacao,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Buscar por nome</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento (Aviso)</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="efetivada">Efetivada</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DesligamentoList
            desligamentos={pagination.paginatedData}
            onView={d => { setSelectedDesligamento(d); setDetailsOpen(true); }}
            onCancel={d => setCancelTarget(d)}
            onApprove={d => setApproveTarget(d)}
            onReject={d => { setRejectTarget(d); setRejectMotivo(''); }}
            onEffect={d => setEffectTarget(d)}
            onPdf={d => setPdfTarget(d)}
            canCancel={canCancel}
            canApprove={canApprove}
            canEffect={canEffect}
          />
          <TablePagination pagination={pagination} />
        </>
      )}

      <DesligamentoDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        desligamento={selectedDesligamento}
      />

      <PdfDesligamentoDialog
        open={!!pdfTarget}
        onOpenChange={open => !open && setPdfTarget(null)}
        target={pdfTarget}
        onGenerate={manuais => { if (pdfTarget) handleGerarPdf(pdfTarget, manuais); }}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Desligamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação de <strong>{cancelTarget?.bd_funcionarios?.nome_completo}</strong> será cancelada.
              Se o funcionário já havia sido alterado, será reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!cancelTarget) return;
              if (!canCancel) { toast.error('Sem permissão.'); return; }
              cancelDesligamento.mutate(
                { id: cancelTarget.id, funcionario_id: cancelTarget.funcionario_id, status: cancelTarget.status },
                { onSuccess: () => setCancelTarget(null) },
              );
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!approveTarget} onOpenChange={open => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação será marcada como aprovada. O funcionário NÃO será alterado ainda — a efetivação é uma ação separada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!approveTarget) return;
              aprovarDesligamento.mutate(approveTarget.id, { onSuccess: () => setApproveTarget(null) });
            }}>Aprovar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!effectTarget} onOpenChange={open => !open && setEffectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Efetivar Desligamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {effectTarget?.tipo_desligamento === 'sem_aviso'
                ? 'O funcionário será INATIVADO imediatamente e movido para arquivo morto.'
                : 'O funcionário entrará em Aviso Prévio. A inativação automática ocorrerá ao fim do prazo.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!effectTarget) return;
              efetivarDesligamento.mutate(effectTarget, { onSuccess: () => setEffectTarget(null) });
            }}>Efetivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo da reprovação</Label>
            <Textarea value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)} rows={4}
              placeholder="Descreva o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={!rejectMotivo.trim()} onClick={() => {
              if (!rejectTarget) return;
              reprovarDesligamento.mutate(
                { id: rejectTarget.id, motivo: rejectMotivo.trim(), observacoes: rejectTarget.observacoes },
                { onSuccess: () => setRejectTarget(null) },
              );
            }}>Reprovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesligamentosSection;
