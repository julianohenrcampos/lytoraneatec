import { TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { SimulacaoValores as SimulacaoValoresType } from '@/utils/diariasPeriodoUtils';
import { formatCurrency } from '@/utils/diariasPeriodoUtils';
import { EstimativaAviso } from './EstimativaAviso';

interface SimulacaoValoresProps {
  simulacao: SimulacaoValoresType;
  diasUteis: number;
  diasFdsFeriados: number;
}

export function SimulacaoValores({ 
  simulacao, 
  diasUteis, 
  diasFdsFeriados 
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
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Total dias úteis ({diasUteis}):
            </p>
            <p className="font-semibold">
              {formatCurrency(simulacao.totalDiasUteis)}
            </p>
          </div>
          
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Total FDS/Feriados ({diasFdsFeriados}):
            </p>
            <p className="font-semibold">
              {formatCurrency(simulacao.totalFdsFeriados)}
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
