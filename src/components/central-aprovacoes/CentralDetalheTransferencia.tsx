import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  item: CentralApprovalItem;
  onAprovar: () => void;
  onReprovar: () => void;
}

interface DetalheItem {
  id: string;
  nome_snapshot: string;
  matricula_snapshot: string | null;
  cpf_mascarado: string | null;
  cargo_snapshot: string | null;
  centro_custo_origem_snapshot: string | null;
  data_transferencia: string | null;
}

interface DetalhePayload {
  id: string;
  protocolo: string;
  status: string;
  total_funcionarios: number;
  centro_custo_destino_snapshot: string | null;
  observacoes: string | null;
  observacao_decisao: string | null;
  itens: DetalheItem[];
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return '—'; }
}

export default function CentralDetalheTransferencia({ item, onAprovar, onReprovar }: Props) {
  const detalhe = useQuery({
    queryKey: ['transferencia-central-detalhe', item.id],
    queryFn: async (): Promise<DetalhePayload> => {
      const { data, error } = await supabase.rpc('fn_transferencia_central_detalhe', { p_id: item.id });
      if (error) throw error;
      return data as unknown as DetalhePayload;
    },
  });

  return (
    <Card className="rounded-2xl shadow-sm sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] uppercase">{item.moduloLabel}</Badge>
          <Badge variant="outline" className="text-[10px]">{item.statusLabel}</Badge>
          {item.aguardandoMinhaAcao && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Aguardando minha ação</Badge>
          )}
        </div>
        <CardTitle className="text-base mt-2">{item.protocolo}</CardTitle>
        <p className="text-sm text-muted-foreground">{item.titulo}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Solicitante</dt>
            <dd className="font-medium">{item.solicitanteNome ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">CC Destino</dt>
            <dd className="font-medium">{item.centroCustoLabel ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Data da solicitação</dt>
            <dd className="font-medium">{fmtDate(item.dataReferencia)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Funcionários</dt>
            <dd className="font-medium">{detalhe.data?.total_funcionarios ?? '—'}</dd>
          </div>
        </dl>

        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Funcionários da transferência</p>
          {detalhe.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : detalhe.isError ? (
            <p className="text-xs text-destructive">Não foi possível carregar os itens.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {(detalhe.data?.itens ?? []).map((it) => (
                <div key={it.id} className="rounded-md border p-2 text-xs">
                  <p className="font-medium text-sm truncate">{it.nome_snapshot}</p>
                  <p className="text-muted-foreground">
                    {it.cargo_snapshot ?? '—'} · Mat: {it.matricula_snapshot ?? '—'} · CPF: {it.cpf_mascarado ?? '—'}
                  </p>
                  <p className="text-muted-foreground">
                    Origem: {it.centro_custo_origem_snapshot ?? '—'} · Transferência: {fmtDate(it.data_transferencia)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {detalhe.data?.observacao_decisao && (
          <div className="border-t pt-3 text-sm">
            <p className="text-xs text-muted-foreground">Observação da decisão</p>
            <p className="font-medium">{detalhe.data.observacao_decisao}</p>
          </div>
        )}

        <div className="border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={onReprovar}
              disabled={!item.canReject}
            >
              <XCircle className="h-4 w-4" /> Rejeitar
            </Button>
            <Button className="gap-2" onClick={onAprovar} disabled={!item.canApprove}>
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
          </div>
          {!item.canApprove && item.approveBlockReason === 'sem_permissao' && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Apenas o engenheiro responsável pelo CC destino pode decidir esta solicitação.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
