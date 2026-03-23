import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { SolicitacaoGestao, GestaoFluxoRole } from '@/hooks/diarias/useGestaoAprovacoesDiarias';

interface Props {
  solicitacoes: SolicitacaoGestao[];
  userFluxoRole: GestaoFluxoRole;
  onVerDetalhes: (sol: SolicitacaoGestao) => void;
  onAprovar: (sol: SolicitacaoGestao) => void;
  onReprovar: (sol: SolicitacaoGestao) => void;
}

const statusColorMap: Record<string, string> = {
  aguardando_aprovacao_gerenteadm: 'bg-amber-100 text-amber-800 border-amber-300',
  aguardando_aprovacao_diretor_operacional: 'bg-blue-100 text-blue-800 border-blue-300',
  aguardando_aprovacao_diretor_adm: 'bg-purple-100 text-purple-800 border-purple-300',
  ajuste_solicitado_adm: 'bg-red-100 text-red-800 border-red-300',
  finalizado: 'bg-green-100 text-green-800 border-green-300',
};

const statusLabelMap: Record<string, string> = {
  aguardando_aprovacao_gerenteadm: 'Aguardando Gerente ADM',
  aguardando_aprovacao_diretor_operacional: 'Aguardando Dir. Operacional',
  aguardando_aprovacao_diretor_adm: 'Aguardando Dir. ADM',
  ajuste_solicitado_adm: 'Ajuste Solicitado',
  finalizado: 'Finalizado',
};

function canActOn(role: GestaoFluxoRole, statusFluxo: string | null): boolean {
  if (role === 'superadmin') return statusFluxo !== 'finalizado';
  if (role === 'gerente_adm') return statusFluxo === 'aguardando_aprovacao_gerenteadm';
  if (role === 'diretor_operacional') return statusFluxo === 'aguardando_aprovacao_diretor_operacional';
  if (role === 'diretor_adm') return statusFluxo === 'aguardando_aprovacao_diretor_adm';
  return false;
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function GestaoAprovacoesMobileCards({
  solicitacoes,
  userFluxoRole,
  onVerDetalhes,
  onAprovar,
  onReprovar,
}: Props) {
  if (!solicitacoes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-base font-medium text-foreground">Nenhuma solicitação encontrada</p>
        <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros aplicados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {solicitacoes.map((sol) => {
        const statusKey = sol.status_fluxo || '';
        const colorClass = statusColorMap[statusKey] || 'bg-muted text-muted-foreground';
        const showActions = canActOn(userFluxoRole, sol.status_fluxo);

        return (
          <Card
            key={sol.id}
            className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            <div className="p-5 space-y-3">
              {/* Header: número + status */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-foreground leading-tight">
                    {sol.numero_solicitacao}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Etapa {sol.etapa_atual || '-'}
                  </p>
                </div>
                <Badge variant="outline" className={`text-xs whitespace-nowrap shrink-0 ${colorClass}`}>
                  {statusLabelMap[statusKey] || statusKey.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Centro de Custo</span>
                  <span className="text-right font-medium text-foreground max-w-[60%] truncate">
                    {sol.bd_centros_custo?.codigo_centro_custo} — {sol.bd_centros_custo?.nome_centro_custo || '-'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solicitante</span>
                  <span className="font-medium text-foreground">{sol.profiles?.nome_completo || '-'}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período</span>
                  <span className="font-medium text-foreground">
                    {format(new Date(sol.data_inicio), 'dd/MM/yy', { locale: ptBR })}
                    {' — '}
                    {format(new Date(sol.data_fim), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total</span>
                  <span className="font-semibold text-foreground">
                    {brlFormatter.format(sol.valor_estimado_total || 0)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo Envio</span>
                  <span className="font-medium text-foreground capitalize">{sol.tipo_envio || 'normal'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-border px-5 py-3 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11 text-sm gap-2"
                onClick={() => onVerDetalhes(sol)}
              >
                <Eye className="h-4 w-4" />
                Ver
              </Button>
              {showActions && (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 text-sm gap-2 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                    onClick={() => onAprovar(sol)}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Aprovar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-11 text-sm gap-2 text-red-700 border-red-300 hover:bg-red-50 hover:text-red-800"
                    onClick={() => onReprovar(sol)}
                  >
                    <XCircle className="h-4 w-4" />
                    Reprovar
                  </Button>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
