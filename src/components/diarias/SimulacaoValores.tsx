import { TrendingUp, Wallet, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { SimulacaoValores as SimulacaoValoresType } from '@/utils/diariasPeriodoUtils';
import { formatCurrency } from '@/utils/diariasPeriodoUtils';
import { EstimativaAviso } from './EstimativaAviso';
import { parseISO, format } from 'date-fns';

type SimulacaoExtras = SimulacaoValoresType & {
  _fonteRefeicaoFds?: 'ultimo_fds' | 'fallback';
  _sabadoAnteriorCount?: number | null;
  _domingoAnteriorCount?: number | null;
  _datasFdsConsideradas?: { sabado: string | null; domingo: string | null };
  _qtdFdsUsados?: number;
  _fdsRecentes?: Array<{ sabado: string; domingo: string; qtdSab: number; qtdDom: number }>;
};

interface SimulacaoValoresProps {
  simulacao: SimulacaoExtras;
  diasUteis: number;
  diasFds: number;
  diasParaRefeicao: number;
}

export function SimulacaoValores({ 
  simulacao, 
  diasUteis, 
  diasFds,
  diasParaRefeicao
}: SimulacaoValoresProps) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Simulação de Valores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Dias Úteis ({diasUteis}):
            </p>
            <p className="font-semibold">
              {formatCurrency(simulacao.totalDiasUteisESabados)}
            </p>
            <p className="text-xs text-muted-foreground">Diária Normal</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Sáb/Dom/Feriados ({diasFds}):
            </p>
            <p className="font-semibold">
              {formatCurrency(simulacao.totalDomFeriados)}
            </p>
            <p className="text-xs text-muted-foreground">Diária Exclusiva</p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">
              Refeições ({diasParaRefeicao}):
            </p>
            <p className="font-semibold">
              {formatCurrency(simulacao.totalRefeicoes)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="font-medium">TOTAL ESTIMADO:</span>
          </div>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(simulacao.totalEstimado)}
          </span>
        </div>

        <EstimativaAviso variant="compact" />
      </CardContent>
    </Card>
  );
}
