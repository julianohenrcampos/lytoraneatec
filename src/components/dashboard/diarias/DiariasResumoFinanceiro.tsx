import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  classificarDia,
  emptyAgg,
  formatBRL,
  somarPresenca,
  type BreakdownAgg,
  type DiariasFilters,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasResumoFinanceiro({ filters }: Props) {
  const { data: ds, isLoading } = useDiariasDataset(filters);

  const data = useMemo(() => {
    if (!ds) return null;
    const uteis = emptyAgg();
    const fds = emptyAgg();
    const total = emptyAgg();
    for (const p of ds.presencas) {
      if (!p.data) continue;
      const cat = classificarDia(p.data, ds.feriadosSet);
      somarPresenca(cat === "uteis" ? uteis : fds, p);
      somarPresenca(total, p);
    }
    return { uteis, fds, total };
  }, [ds]);

  const renderRow = (label: string, agg: BreakdownAgg, highlight = false) => (
    <tr className={highlight ? "border-t-2 border-primary/30 font-semibold bg-muted/30" : "border-t"}>
      <td className="py-2 px-3">{label}</td>
      <td className="py-2 px-3 text-right tabular-nums">{agg.qtd}</td>
      <td className="py-2 px-3 text-right tabular-nums">{formatBRL(agg.diaria)}</td>
      <td className="py-2 px-3 text-right tabular-nums">{formatBRL(agg.refeicao)}</td>
      <td className="py-2 px-3 text-right tabular-nums">{formatBRL(agg.total)}</td>
    </tr>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resumo Financeiro por Tipo de Dia</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : !data || data.total.qtd === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados suficientes no período
          </div>
        ) : data.total.total === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem valores financeiros disponíveis para este perfil/contexto
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs uppercase">
                  <th className="text-left py-2 px-3 font-medium">Tipo</th>
                  <th className="text-right py-2 px-3 font-medium">Qtd</th>
                  <th className="text-right py-2 px-3 font-medium">Diárias Aplicadas</th>
                  <th className="text-right py-2 px-3 font-medium">Refeições</th>
                  <th className="text-right py-2 px-3 font-medium">Total Executado</th>
                </tr>
              </thead>
              <tbody>
                {renderRow("Dias Úteis", data.uteis)}
                {renderRow("Sáb / Dom / Feriados", data.fds)}
                {renderRow("Total Geral", data.total, true)}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
