import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePermission } from '@/hooks/usePermission';
import type { SolicitacaoGestao, GestaoFluxoRole } from '@/hooks/diarias/useGestaoAprovacoesDiarias';

const SEGREGACAO_MSG_CRIADOR =
  'Você criou esta solicitação. A aprovação deve ser feita por outro aprovador autorizado.';

interface Props {
  solicitacoes: SolicitacaoGestao[];
  userFluxoRole: GestaoFluxoRole;
  onVerDetalhes: (sol: SolicitacaoGestao) => void;
  onAprovar: (sol: SolicitacaoGestao) => void;
  onReprovar: (sol: SolicitacaoGestao) => void;
}

const statusBadgeConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aguardando_aprovacao_gerenteadm: { label: 'Aguardando Gerente ADM', variant: 'outline' },
  aguardando_aprovacao_diretor_operacional: { label: 'Aguardando Dir. Operacional', variant: 'secondary' },
  aguardando_aprovacao_diretor_adm: { label: 'Aguardando Dir. ADM', variant: 'default' },
  ajuste_solicitado_adm: { label: 'Ajuste Solicitado', variant: 'destructive' },
  finalizado: { label: 'Finalizado', variant: 'default' },
};

const statusColorMap: Record<string, string> = {
  aguardando_aprovacao_gerenteadm: 'bg-amber-100 text-amber-800 border-amber-300',
  aguardando_aprovacao_diretor_operacional: 'bg-blue-100 text-blue-800 border-blue-300',
  aguardando_aprovacao_diretor_adm: 'bg-purple-100 text-purple-800 border-purple-300',
  ajuste_solicitado_adm: 'bg-red-100 text-red-800 border-red-300',
  finalizado: 'bg-green-100 text-green-800 border-green-300',
};

function canActOn(role: GestaoFluxoRole, statusFluxo: string | null): boolean {
  if (role === 'superadmin') return statusFluxo !== 'finalizado';
  if (role === 'gerente_adm') return statusFluxo === 'aguardando_aprovacao_gerenteadm';
  // D1 Fase 2: GerenteRegional atua na mesma etapa do GerenteAdm.
  if (role === 'gerente_regional') return statusFluxo === 'aguardando_aprovacao_gerenteadm';
  if (role === 'diretor_operacional') return statusFluxo === 'aguardando_aprovacao_diretor_operacional';
  if (role === 'diretor_adm') return statusFluxo === 'aguardando_aprovacao_diretor_adm';
  return false;
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function GestaoAprovacoesTabelaDesktop({
  solicitacoes,
  userFluxoRole,
  onVerDetalhes,
  onAprovar,
  onReprovar,
}: Props) {
  // D1.1: detectar segregação para tooltip e bloqueio do botão Aprovar.
  const { userId, isSuperAdmin, hasActionPermission } = usePermission();
  // D1 Fase 2: gate defensivo extra para GerenteRegional.
  const gerenteRegionalSemPermissao =
    userFluxoRole === 'gerente_regional' && !hasActionPermission('diarias_aprovar', 'aprovar');
  if (!solicitacoes.length) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
        Nenhuma solicitação encontrada com os filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="font-semibold">Nº Solicitação</TableHead>
            <TableHead className="font-semibold">Centro de Custo</TableHead>
            <TableHead className="font-semibold">Solicitante</TableHead>
            <TableHead className="font-semibold">Período</TableHead>
            <TableHead className="font-semibold text-right">Valor Total</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-center">Etapa</TableHead>
            <TableHead className="font-semibold">Tipo Envio</TableHead>
            <TableHead className="font-semibold">Atualização</TableHead>
            <TableHead className="font-semibold text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {solicitacoes.map((sol, idx) => {
            const statusKey = sol.status_fluxo || '';
            const badge = statusBadgeConfig[statusKey];
            const colorClass = statusColorMap[statusKey] || 'bg-muted text-muted-foreground';
            const showActions = canActOn(userFluxoRole, sol.status_fluxo) && !gerenteRegionalSemPermissao;
            // D1.1: criador não pode aprovar a própria solicitação (segregação).
            const bloqueadoPorSegregacao =
              !isSuperAdmin && !!userId && !!sol.criado_por && sol.criado_por === userId;

            return (
              <TableRow
                key={sol.id}
                className={cn(
                  'transition-colors duration-150 hover:bg-muted/50',
                  idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
              >
                <TableCell className="font-medium">{sol.numero_solicitacao}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">{sol.bd_centros_custo?.codigo_centro_custo}</span>
                  <br />
                  <span className="text-sm">{sol.bd_centros_custo?.nome_centro_custo || '-'}</span>
                </TableCell>
                <TableCell>{sol.profiles?.nome_completo || '-'}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {format(new Date(sol.data_inicio), 'dd/MM/yy', { locale: ptBR })}
                  {' — '}
                  {format(new Date(sol.data_fim), 'dd/MM/yy', { locale: ptBR })}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {brlFormatter.format(sol.valor_estimado_total || 0)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs whitespace-nowrap ${colorClass}`}>
                    {badge?.label || statusKey.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">{sol.etapa_atual || '-'}</TableCell>
                <TableCell className="capitalize">{sol.tipo_envio || 'normal'}</TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {sol.updated_at
                    ? format(new Date(sol.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Ver detalhes"
                      onClick={() => onVerDetalhes(sol)}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    {showActions && (
                      <>
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(bloqueadoPorSegregacao && 'cursor-not-allowed')}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title={bloqueadoPorSegregacao ? SEGREGACAO_MSG_CRIADOR : 'Aprovar'}
                                  disabled={bloqueadoPorSegregacao}
                                  onClick={() => onAprovar(sol)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {bloqueadoPorSegregacao && (
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                {SEGREGACAO_MSG_CRIADOR}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Reprovar"
                          onClick={() => onReprovar(sol)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
