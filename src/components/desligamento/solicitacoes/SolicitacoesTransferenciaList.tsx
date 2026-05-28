import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Loader2, Ban, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useSolicitacoesTransferencia,
  useCancelarSolicitacaoTransferencia,
  useExcluirSolicitacaoTransferencia,
} from '@/hooks/rh/useSolicitacoesTransferencia';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { toast } from 'sonner';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusMap: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
  emitida: { label: 'Emitida', cls: 'bg-primary/15 text-primary border-primary/30' },
  cancelada: { label: 'Cancelada', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

interface Props {
  onOpen: (id: string) => void;
  canCancel?: boolean;
  canDelete?: boolean;
}

export const SolicitacoesTransferenciaList: React.FC<Props> = ({ onOpen, canCancel = false, canDelete = false }) => {
  const { data, isLoading } = useSolicitacoesTransferencia();
  const cancelar = useCancelarSolicitacaoTransferencia();
  const excluir = useExcluirSolicitacaoTransferencia();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; protocolo: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Nenhuma solicitação encontrada.
      </div>
    );
  }
  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead className="text-center">Qtd</TableHead>
              <TableHead className="text-right">Total Salários</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => {
              const st = statusMap[s.status];
              const isDraft = s.status === 'rascunho';
              const podeCancelar = canCancel && s.status !== 'cancelada';
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.protocolo}</TableCell>
                  <TableCell>{formatBrazilianDateForDisplay(s.data_solicitacao.slice(0, 10))}</TableCell>
                  <TableCell>{s.solicitante_nome_snapshot || '—'}</TableCell>
                  <TableCell className="text-center">{s.total_funcionarios}</TableCell>
                  <TableCell className="text-right">{fmtBRL(Number(s.total_salarios) || 0)}</TableCell>
                  <TableCell><Badge variant="outline" className={st.cls}>{st.label}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => onOpen(s.id)}>
                      {isDraft ? <Pencil className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                      {isDraft ? 'Editar' : 'Visualizar'}
                    </Button>
                    {podeCancelar && (
                      <Button variant="ghost" size="sm" onClick={() => setCancelId(s.id)}>
                        <Ban className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: s.id, protocolo: s.protocolo })}
                        title="Excluir definitivamente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação ficará marcada como cancelada. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!cancelId) return;
                cancelar.mutate(cancelId, {
                  onSuccess: () => { toast.success('Solicitação cancelada.'); setCancelId(null); },
                  onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'falha ao cancelar')),
                });
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação <strong>{deleteTarget?.protocolo}</strong> e todos os seus itens serão
              removidos permanentemente do sistema. Esta ação é irreversível e não altera o cadastro
              dos funcionários.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                excluir.mutate(deleteTarget.id, {
                  onSuccess: () => { toast.success('Solicitação excluída.'); setDeleteTarget(null); },
                  onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'falha ao excluir')),
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
