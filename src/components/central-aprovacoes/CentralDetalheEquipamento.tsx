import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, RotateCcw, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR, formatDateTimeBR } from '@/utils/formatDateBR';
import { formatItemDisplay, isNaoCadastrado, type ItemDisplayInput } from '@/utils/solicitacaoItemDisplay';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';
import { statusVisual } from './statusVisual';
import { cn } from '@/lib/utils';

interface DetalheItem extends ItemDisplayInput {
  id: string;
  quantidade?: number | null;
  com_operador?: boolean | null;
  regime_trabalho?: string | null;
  regime_personalizado?: string | null;
  tempo_previsto_dias?: number | null;
  observacoes?: string | null;
  status_item?: string | null;
}

interface Aprovacao {
  id: string;
  etapa_aprovacao: string | null;
  aprovador_nome: string | null;
  status: string | null;
  comentario: string | null;
  data_decisao: string | null;
  created_at: string | null;
}

interface Detalhe {
  solicitacao: {
    id: string;
    codigo_cc: string | null;
    nome_cc: string | null;
    solicitante_nome: string | null;
    engenheiro_nome: string | null;
    apontador_nome: string | null;
    aprovador_nome: string | null;
    status: string | null;
    status_fluxo: string | null;
    prioridade: string | null;
    quantidade: number | null;
    data_inicio: string | null;
    tempo_previsto_dias: number | null;
    regime_trabalho: string | null;
    com_operador: boolean | null;
    justificativa: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  itens: DetalheItem[];
  aprovacao_atual?: Aprovacao | null;
  aprovacao?: Aprovacao | null;
  historico_aprovacoes?: Aprovacao[];
  post_decision_capabilities?: {
    can_reverter: boolean;
    can_cancelar: boolean;
    block_reason: string | null;
  };
}

interface Props {
  item: CentralApprovalItem;
  onAprovar: () => void;
  onReprovar: () => void;
  onReverter?: () => void;
  onCancelar?: () => void;
}

const REASON_LABEL: Record<string, string> = {
  auto_aprovacao_bloqueada: 'Você não pode aprovar sua própria solicitação.',
  not_available: 'Solicitação indisponível ou fora do seu escopo.',
  nao_pendente: 'A solicitação já não está pendente.',
  sem_permissao_aprovar: 'Você não tem permissão para aprovar esta etapa.',
};

export default function CentralDetalheEquipamento({
  item, onAprovar, onReprovar, onReverter, onCancelar,
}: Props) {
  const query = useQuery<Detalhe>({
    queryKey: ['central-aprovacoes', 'equipamentos', 'detalhe', item.id],
    enabled: !!item?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'fn_solic_equip_detalhe_central' as any,
        { p_solicitacao_id: item.id } as any,
      );
      if (error) throw error;
      return data as Detalhe;
    },
    staleTime: 15_000,
  });

  const detalhe = query.data;
  const aprovacaoAtual = detalhe?.aprovacao_atual ?? detalhe?.aprovacao ?? null;
  const historico = detalhe?.historico_aprovacoes ?? [];
  const posDec = detalhe?.post_decision_capabilities;
  const canReverter = !!(posDec?.can_reverter && onReverter);
  const canCancelar = !!(posDec?.can_cancelar && onCancelar);

  const actionsDisabled = query.isLoading || query.isError;

  const visual = statusVisual(item.statusCodigo);

  return (
    <Card className={cn('rounded-2xl shadow-sm sticky top-4 border-l-4', visual.border, visual.bg)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] uppercase">{item.moduloLabel}</Badge>
          <Badge variant="outline" className={cn('text-[10px]', visual.badgeClass)}>{item.statusLabel}</Badge>
          {item.urgente && <Badge className="bg-red-100 text-red-700 border-red-300 text-[10px]">Urgente</Badge>}
          {item.aguardandoMinhaAcao && (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Aguardando minha ação</Badge>
          )}
        </div>
        <CardTitle className="text-base mt-2">{item.protocolo}</CardTitle>
        <p className="text-sm text-muted-foreground">{item.titulo}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div>
                <p className="font-medium">Não foi possível carregar o detalhe.</p>
                <p className="text-xs opacity-90">
                  Protocolo: <span className="font-mono">{item.protocolo}</span>
                  {item.centroCustoLabel ? <> · CC: {item.centroCustoLabel}</> : null}
                </p>
                <p className="text-xs opacity-90">Status: {item.statusLabel}</p>
                <p className="text-xs opacity-75 mt-1">
                  Detalhe técnico: {(query.error as Error)?.message ?? 'erro desconhecido'}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => query.refetch()}>
                <RefreshCw className="h-3 w-3" /> Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : detalhe ? (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Centro de Custo" value={ccLabel(detalhe)} />
              <Field label="Prioridade" value={detalhe.solicitacao.prioridade ?? '—'} />
              <Field label="Solicitante" value={detalhe.solicitacao.solicitante_nome} />
              <Field label="Engenheiro" value={detalhe.solicitacao.engenheiro_nome} />
              <Field label="Apontador" value={detalhe.solicitacao.apontador_nome} />
              <Field label="Aprovador do CC" value={detalhe.solicitacao.aprovador_nome} />
              <Field label="Data da solicitação" value={formatDateTimeBR(detalhe.solicitacao.created_at)} />
              <Field label="Data de início" value={formatDateBR(detalhe.solicitacao.data_inicio)} />
              <Field label="Quantidade" value={detalhe.solicitacao.quantidade ?? '—'} />
              <Field label="Tempo previsto (dias)" value={detalhe.solicitacao.tempo_previsto_dias ?? '—'} />
              <Field label="Regime" value={detalhe.solicitacao.regime_trabalho ?? '—'} />
              <Field label="Com operador" value={detalhe.solicitacao.com_operador ? 'Sim' : 'Não'} />
            </dl>

            {detalhe.solicitacao.justificativa && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Justificativa</p>
                <p className="text-sm whitespace-pre-wrap">{detalhe.solicitacao.justificativa}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2">Itens</p>
              <div className="space-y-2">
                {detalhe.itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
                {detalhe.itens.map((it) => (
                  <div key={it.id} className="border rounded-md p-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{formatItemDisplay(it)}</span>
                      {isNaoCadastrado(it) && (
                        <Badge variant="outline" className="text-[10px]">Não catalogado</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Qtd: {it.quantidade ?? '—'} · Regime: {it.regime_trabalho ?? '—'}
                      {it.com_operador ? ' · Com operador' : ''}
                      {it.tempo_previsto_dias ? ` · ${it.tempo_previsto_dias} dias` : ''}
                    </div>
                    {it.observacoes && <p className="text-xs mt-1">{it.observacoes}</p>}
                  </div>
                ))}
              </div>
            </div>

            {aprovacaoAtual && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-1">Aprovação atual</p>
                <p className="text-sm">Status: {aprovacaoAtual.status ?? '—'}</p>
                {aprovacaoAtual.aprovador_nome && (
                  <p className="text-xs text-muted-foreground">Por: {aprovacaoAtual.aprovador_nome}</p>
                )}
                {aprovacaoAtual.data_decisao && (
                  <p className="text-xs text-muted-foreground">Em: {formatDateTimeBR(aprovacaoAtual.data_decisao)}</p>
                )}
                {aprovacaoAtual.comentario && (
                  <p className="text-sm mt-1 whitespace-pre-wrap">{aprovacaoAtual.comentario}</p>
                )}
              </div>
            )}

            {historico.length > 1 && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Histórico de aprovações</p>
                <div className="space-y-2">
                  {historico.map((h) => (
                    <div key={h.id} className="border rounded-md p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px]">{h.status ?? '—'}</Badge>
                        <span className="text-muted-foreground">
                          {formatDateTimeBR(h.data_decisao ?? h.created_at)}
                        </span>
                      </div>
                      {h.aprovador_nome && (
                        <p className="mt-1"><span className="text-muted-foreground">Por: </span>{h.aprovador_nome}</p>
                      )}
                      {h.comentario && (
                        <p className="mt-1 whitespace-pre-wrap">{h.comentario}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {item.autoApproval && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você é o solicitante desta demanda. A aprovação será auditada como autoaprovação.
            </AlertDescription>
          </Alert>
        )}

        <div className="border-t pt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={onReprovar}
            disabled={actionsDisabled || !item.canReject}
          >
            <XCircle className="h-4 w-4" /> Reprovar
          </Button>
          <Button className="gap-2" onClick={onAprovar} disabled={actionsDisabled || !item.canApprove}>
            <CheckCircle2 className="h-4 w-4" /> Aprovar
          </Button>
        </div>
        {!actionsDisabled && !item.canApprove && item.approveBlockReason && (
          <p className="text-xs text-muted-foreground text-center">
            {REASON_LABEL[item.approveBlockReason] ?? `Ação indisponível (${item.approveBlockReason}).`}
          </p>
        )}

        {(canReverter || canCancelar) && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Ações pós-decisão (SuperAdm)</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={onReverter} disabled={!canReverter}>
                <RotateCcw className="h-4 w-4" /> Reverter
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={onCancelar}
                disabled={!canCancelar}
              >
                <Ban className="h-4 w-4" /> Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value == null || value === '' ? '—' : String(value)}</dd>
    </div>
  );
}

function ccLabel(d: Detalhe): string {
  const s = d.solicitacao;
  if (s.codigo_cc && s.nome_cc) return `${s.codigo_cc} - ${s.nome_cc}`;
  return s.codigo_cc ?? '—';
}
