import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, type DiariasFilters } from "./_dashboardHelpers";
import { useDiariasRankingCentrosCusto } from "./useDiariasRankingCentrosCusto";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasRankingCentrosCusto({ filters }: Props) {
  const { data, isLoading } = useDiariasRankingCentrosCusto(filters);

  // Oculta CCs zerados (sem quantidade e sem valor executado).
  const visiveis = useMemo(
    () =>
      (data || []).filter(
        (r) => r.funcUteis > 0 || r.funcFds > 0 || r.executado > 0
      ),
    [data]
  );
  const totalExec = useMemo(
    () => visiveis.reduce((s, r) => s + r.executado, 0),
    [visiveis]
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Centros de Custo — Visão Executiva</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col p-0">
        {isLoading ? (
          <div className="px-6 pb-6">
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : visiveis.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados financeiros disponíveis no período/perfil
          </div>
        ) : (
          <>
            <div className="overflow-auto max-h-[480px] px-6">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left py-2 px-2 font-medium">Centro de Custo</th>
                    <th className="text-left py-2 px-2 font-medium">Gerente Regional</th>
                    <th className="text-right py-2 px-2 font-medium">Apont. Úteis</th>
                    <th className="text-right py-2 px-2 font-medium">Valor Úteis</th>
                    <th className="text-right py-2 px-2 font-medium">Apont. FDS/Fer.</th>
                    <th className="text-right py-2 px-2 font-medium">Valor FDS/Fer.</th>
                    <th className="text-right py-2 px-2 font-medium">Refeições</th>
                    <th className="text-right py-2 px-2 font-medium">Executado</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((r) => (
                    <tr key={r.centro_custo_id} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-2 font-medium">
                        {r.codigo}{" "}
                        <span className="text-muted-foreground font-normal">— {r.nome}</span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{r.gerente}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.funcUteis}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatBRL(r.valorUteis)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.funcFds}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatBRL(r.valorFds)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatBRL(r.refeicao)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-green-600">
                        {formatBRL(r.executado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-6 py-3 flex items-center justify-between bg-card">
              <span className="text-xs text-muted-foreground">
                {visiveis.length} centro(s) de custo com lançamento
              </span>
              <span className="text-sm font-semibold">
                Total Executado:{" "}
                <span className="text-green-600">{formatBRL(totalExec)}</span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
