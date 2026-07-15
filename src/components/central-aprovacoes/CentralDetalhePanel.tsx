import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';
import CentralDetalheEquipamento from './CentralDetalheEquipamento';

interface Props {
  item: CentralApprovalItem | null;
  onVer: () => void;
  onAprovar: () => void;
  onReprovar: () => void;
  onReverter?: () => void;
  onCancelar?: () => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
}
function fmtBRL(v: number | null): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export default function CentralDetalhePanel({ item, onVer, onAprovar, onReprovar, onReverter, onCancelar }: Props) {
  if (!item) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Selecione uma solicitação para visualizar os detalhes.
        </CardContent>
      </Card>
    );
  }

  if (item.modulo === 'equipamentos') {
    return (
      <CentralDetalheEquipamento
        item={item}
        onAprovar={onAprovar}
        onReprovar={onReprovar}
        onReverter={onReverter}
        onCancelar={onCancelar}
      />
    );
  }


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
            <dt className="text-xs text-muted-foreground">Centro de Custo</dt>
            <dd className="font-medium">{item.centroCustoLabel ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Data-base</dt>
            <dd className="font-medium">{item.dataReferencia ? format(new Date(item.dataReferencia), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Valor estimado</dt>
            <dd className="font-medium">{fmtBRL(item.valorEstimado)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Última atualização</dt>
            <dd className="font-medium">{fmtDate(item.atualizadoEm)}</dd>
          </div>
        </dl>

        <div className="border-t pt-3 flex flex-col gap-2">
          <Button variant="outline" className="gap-2 w-full" onClick={onVer}>
            <Eye className="h-4 w-4" /> Ver detalhes completos
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={onReprovar}
              disabled={!item.canReject}
            >
              <XCircle className="h-4 w-4" /> Reprovar
            </Button>
            <Button className="gap-2" onClick={onAprovar} disabled={!item.canApprove}>
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
          </div>
          {item.capabilitiesUnavailable ? (
            <p className="text-xs text-destructive text-center">
              Não foi possível verificar suas permissões. Atualize a página e tente novamente.
            </p>
          ) : !item.canApprove && item.approveBlockReason ? (
            <p className="text-xs text-muted-foreground text-center">
              {reasonLabel(item.approveBlockReason)}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'assinatura_ausente': return 'Cadastre sua assinatura digital antes de aprovar.';
    case 'sem_permissao_aprovar': return 'Você não tem permissão para aprovar esta etapa.';
    case 'override_deny': return 'Aprovação bloqueada por override de permissão.';
    case 'already_decided': return 'Esta solicitação já foi decidida.';
    case 'estado_nao_acionavel': return 'Este item não está em uma etapa acionável.';
    case 'fluxo_sem_etapa_ativa': return 'O fluxo dinâmico não possui etapa ativa.';
    case 'motor_invalido': return 'Motor de aprovação inválido — contate o suporte.';
    case 'capacidades_indisponiveis': return 'Capacidades indisponíveis.';
    default: return `Ação indisponível (${reason}).`;
  }
}

