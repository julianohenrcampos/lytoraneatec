/**
 * Preview Visual dos Dias da Demanda — Fase 1C.
 *
 * Componente PURO read-only. Não faz fetch, não muta nada, não dispara
 * efeito colateral, não chama RPC, não chama `gravarConvocadosPre` e não
 * chama `funcionarioAprovadoNaData`. Consome apenas o adapter
 * (`lerConvocadosPre` + `derivarFuncionariosPlanos`) sobre dados já
 * carregados pelo modal hospedeiro.
 *
 * Renderização condicionada por `DIARIAS_LOTES_UI_PREVIEW` no host
 * (`SolicitacaoDetalhesModal`). Com a flag desligada, este componente nem
 * é montado, portanto seu corpo não executa.
 */
import { useMemo } from 'react';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import {
  lerConvocadosPre,
  derivarFuncionariosPlanos,
} from '@/lib/diarias/convocadosPreAdapter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LotesPreviewBadge } from './LotesPreviewBadge';

interface LotesPreviewPanelProps {
  convocadosPreRaw: unknown;
  periodo: { inicio: string; fim: string };
}

export function LotesPreviewPanel({
  convocadosPreRaw,
  periodo,
}: LotesPreviewPanelProps) {
  const view = useMemo(
    () => lerConvocadosPre(convocadosPreRaw, periodo),
    [convocadosPreRaw, periodo],
  );

  const totalFuncionarios = useMemo(
    () => derivarFuncionariosPlanos(view).length,
    [view],
  );

  const datas = view.lotes[0]?.datas ?? [];

  return (
    <Card
      role="region"
      aria-label="Preview de lotes da solicitação"
      className="border-dashed border-border bg-muted/30"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LotesPreviewBadge />
            <span>
              {formatBrazilianDateForDisplay(periodo.inicio)}
              {periodo.fim !== periodo.inicio && (
                <> → {formatBrazilianDateForDisplay(periodo.fim)}</>
              )}
            </span>
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {totalFuncionarios}{' '}
            {totalFuncionarios === 1 ? 'funcionário' : 'funcionários'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {datas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem datas no período.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
            {datas.map((data) => {
              const qtd = view.funcionariosPorData.get(data)?.length ?? 0;
              return (
                <div
                  key={data}
                  className="flex flex-col items-center justify-center rounded-md border border-border bg-background/60 px-2 py-2 text-center"
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {formatBrazilianDateForDisplay(data)}
                  </span>
                  <span className="mt-1 text-base font-semibold text-foreground">
                    {qtd}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {qtd === 1 ? 'func.' : 'funcs.'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] italic text-muted-foreground">
          Preview — não afeta operação real.
        </p>
      </CardContent>
    </Card>
  );
}
