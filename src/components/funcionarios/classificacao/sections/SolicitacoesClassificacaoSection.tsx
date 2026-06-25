import React, { useMemo, useState } from 'react';
import { Plus, AlertTriangle, Eye, Pencil, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { usePermission } from '@/hooks/usePermission';
import {
  useSolicitacoesClassificacaoLote,
  useCancelarRascunhoVazio,
} from '@/hooks/rh/useSolicitacoesClassificacaoLote';
import { toast } from 'sonner';
import { SolicitacaoClassificacaoLoteDialog } from '@/components/funcionarios/classificacao/SolicitacaoClassificacaoLoteDialog';

const BASE_PERMISSION = 'gestao_rh_solicitacoes_classificacao_view';

const SolicitacoesClassificacaoSection: React.FC = () => {
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const can = (a: 'visualizar' | 'criar' | 'editar' | 'excluir') =>
    isSuperAdmin || hasActionPermission(BASE_PERMISSION, a);

  const { data: lotes = [], isLoading, isError } = useSolicitacoesClassificacaoLote();
  const cancelarMut = useCancelarRascunhoVazio();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  const inconsistentes = useMemo(
    () => lotes.filter((l) => l.inconsistente),
    [lotes],
  );

  const handleNovo = () => {
    if (!can('criar')) {
      toast.error('Você não tem permissão para criar solicitações.');
      return;
    }
    setEditId(null);
    setViewOnly(false);
    setOpen(true);
  };

  const handleAbrir = (id: string, somenteLeitura: boolean) => {
    setEditId(id);
    setViewOnly(somenteLeitura);
    setOpen(true);
  };

  const renderBadge = (
    status: string,
    total: number,
    inconsistente: boolean,
  ) => {
    if (inconsistente) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Inconsistência: rascunho com itens
        </Badge>
      );
    }
    if (status === 'rascunho') {
      return <Badge variant="secondary">Rascunho sem itens</Badge>;
    }
    if (status === 'emitida') {
      return <Badge>Emitida</Badge>;
    }
    if (status === 'cancelada') {
      return <Badge variant="outline">Cancelada</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Crie solicitações de classificação em lote. O rascunho salva apenas
          observações — os itens são gravados somente ao emitir.
        </p>
        <Button onClick={handleNovo} disabled={!can('criar')}>
          <Plus className="h-4 w-4 mr-2" /> Nova Solicitação
        </Button>
      </div>

      {inconsistentes.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Lotes em estado inconsistente</AlertTitle>
          <AlertDescription>
            Os seguintes protocolos estão em rascunho mas já possuem itens
            vinculados — provavelmente uma emissão falhou no passo final:{' '}
            <strong>
              {inconsistentes.map((l) => l.protocolo).join(', ')}
            </strong>
            . Correção administrativa manual necessária ou aguardar fase futura
            com RPC transacional. Apenas a visualização está liberada.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-destructive">
              Erro ao carregar solicitações.
            </div>
          ) : lotes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma solicitação cadastrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => {
                  const isRascunhoVazio =
                    l.status === 'rascunho' && l.total_itens === 0;
                  const isReadonly =
                    l.status !== 'rascunho' || l.inconsistente;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">
                        {l.protocolo}
                      </TableCell>
                      <TableCell>
                        {new Date(l.data_solicitacao).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>{l.solicitante_nome_snapshot ?? '-'}</TableCell>
                      <TableCell>{l.total_itens}</TableCell>
                      <TableCell>
                        {renderBadge(l.status, l.total_itens, l.inconsistente)}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAbrir(l.id, true)}
                          disabled={!can('visualizar')}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!isReadonly && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAbrir(l.id, false)}
                            disabled={!can('editar')}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {isRascunhoVazio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCancelTarget(l.id);
                              setCancelMotivo('');
                            }}
                            disabled={!can('excluir')}
                            title="Cancelar rascunho vazio"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SolicitacaoClassificacaoLoteDialog
        open={open}
        loteId={editId}
        viewOnly={viewOnly}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditId(null);
            setViewOnly(false);
          }
        }}
      />

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar rascunho?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas rascunhos sem itens podem ser cancelados nesta fase. Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelarMut.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelarMut.isPending}
              onClick={async () => {
                if (!cancelTarget) return;
                try {
                  await cancelarMut.mutateAsync({
                    id: cancelTarget,
                    motivo: cancelMotivo || null,
                  });
                  setCancelTarget(null);
                } catch {
                  /* toast no hook */
                }
              }}
            >
              Cancelar rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SolicitacoesClassificacaoSection;
