import { useState } from 'react';
import { TrendingUp, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SimulacaoValores as SimulacaoValoresType } from '@/utils/diariasPeriodoUtils';
import { formatCurrency } from '@/utils/diariasPeriodoUtils';
import { EstimativaAviso } from './EstimativaAviso';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type SimulacaoExtras = SimulacaoValoresType & {
  diasNormaisCount?: number;
  diasExclusivosCount?: number;
  diasRefeicaoCount?: number;
  porData?: Array<{
    data: string;
    classificacao: 'util' | 'sabado' | 'fds' | 'feriado' | 'operacional';
    funcionariosCount: number;
    valorDiarias: number;
    valorRefeicoes: number;
    valorTotal: number;
  }>;
};

interface SimulacaoValoresProps {
  simulacao: SimulacaoExtras;
  diasUteis: number;
  diasFds: number;
  diasParaRefeicao: number;
}

const CLASSIF_LABEL: Record<string, { label: string; cls: string }> = {
  util: { label: 'Útil', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  sabado: { label: 'Sáb', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  fds: { label: 'Dom', cls: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  feriado: { label: 'Feriado', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
  operacional: { label: 'Operacional', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
};

export function SimulacaoValores({
  simulacao,
  diasUteis,
  diasFds,
  diasParaRefeicao,
}: SimulacaoValoresProps) {
  const [expand, setExpand] = useState(false);
  const porData = simulacao.porData ?? [];

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
            <p className="text-muted-foreground">Dias Úteis ({diasUteis}):</p>
            <p className="font-semibold">{formatCurrency(simulacao.totalDiasUteisESabados)}</p>
            <p className="text-xs text-muted-foreground">Diária Normal</p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">Sáb/Dom/Feriados ({diasFds}):</p>
            <p className="font-semibold">{formatCurrency(simulacao.totalDomFeriados)}</p>
            <p className="text-xs text-muted-foreground">Diária Exclusiva</p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">Refeições ({diasParaRefeicao}):</p>
            <p className="font-semibold">{formatCurrency(simulacao.totalRefeicoes)}</p>
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

        {porData.length > 0 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setExpand((v) => !v)}
            >
              {expand ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {expand ? 'Ocultar' : 'Ver'} detalhe por data
            </Button>
            {expand && (
              <div className="rounded-md border bg-background/40 divide-y text-xs">
                {porData.map((linha) => {
                  const classif = CLASSIF_LABEL[linha.classificacao] ?? CLASSIF_LABEL.util;
                  const dataLabel = format(parseISO(linha.data), "dd/MM (EEE)", { locale: ptBR });
                  return (
                    <div key={linha.data} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium tabular-nums">{dataLabel}</span>
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${classif.cls}`}>
                          {classif.label}
                        </Badge>
                        <span className="text-muted-foreground">
                          {linha.funcionariosCount} func.
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-muted-foreground">
                          Diárias: <span className="font-medium text-foreground">{formatCurrency(linha.valorDiarias)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Ref.: <span className="font-medium text-foreground">{formatCurrency(linha.valorRefeicoes)}</span>
                        </span>
                        <span className="font-semibold text-primary">{formatCurrency(linha.valorTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <EstimativaAviso variant="compact" />
      </CardContent>
    </Card>
  );
}
