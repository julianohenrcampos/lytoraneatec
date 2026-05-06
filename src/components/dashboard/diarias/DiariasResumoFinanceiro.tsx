import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { DiariasFilters } from "./DashboardDiariasFilters";
import {
  buildSolIdSet,
  classificarDia,
  emptyAgg,
  fetchFeriadosSet,
  fetchPresencasConfirmadas,
  formatBRL,
  somarPresenca,
  type BreakdownAgg,
} from "./_dashboardHelpers";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasResumoFinanceiro({ filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["diarias-resumo-financeiro", filters],
    queryFn: async () => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0) {
        return { uteis: emptyAgg(), fds: emptyAgg(), total: emptyAgg() };
      }
      const [presencas, feriados] = await Promise.all([
        fetchPresencasConfirmadas(filters, solIdSet),
        fetchFeriadosSet(),
      ]);
      const uteis = emptyAgg();
      const fds = emptyAgg();
      const total = emptyAgg();
      for (const p of presencas) {
        if (!p.data) continue;
        const cat = classificarDia(p.data, feriados);
        somarPresenca(cat === "uteis" ? uteis : fds, p);
        somarPresenca(total, p);
      }
      return { uteis, fds, total };
    },
  });

  const renderRow = (label: string, agg: BreakdownAgg, highlight = false) => (
    <tr className={highlight ? "border-t-2 border-primary/30 font-semibold bg-muted/30" : "border-t"}>
      <td className="py-2 px-3">{label}</td>
      <td className="py-2 px-3 text-right tabular-nums">{agg.qtd}</td>
      <td className="py-2 px-3 text-right tabular-nums">{formatBRL(agg.diaria)}</td>
      <td className="py-2 px-3 text-right tabular-nums">{formatBRL(agg.meia)}</td>
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs uppercase">
                  <th className="text-left py-2 px-3 font-medium">Tipo</th>
                  <th className="text-right py-2 px-3 font-medium">Qtd</th>
                  <th className="text-right py-2 px-3 font-medium">Diárias</th>
                  <th className="text-right py-2 px-3 font-medium">½ Diária</th>
                  <th className="text-right py-2 px-3 font-medium">Refeições</th>
                  <th className="text-right py-2 px-3 font-medium">Total</th>
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
