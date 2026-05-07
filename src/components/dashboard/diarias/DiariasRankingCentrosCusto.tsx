import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL, type DiariasFilters } from "./_dashboardHelpers";
import { useDiariasRankingCentrosCusto } from "./useDiariasRankingCentrosCusto";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasRankingCentrosCusto({ filters }: Props) {
  const { data, isLoading } = useDiariasRankingCentrosCusto(filters);
  const totalExec = (data || []).reduce((s, r) => s + r.executado, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Centros de Custo — Visão Executiva</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados suficientes no período
          </div>
        ) : totalExec === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem valores financeiros disponíveis para este perfil/contexto
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
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
                {data.map((r) => (
                  <tr key={r.centro_custo_id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-medium">
                      {r.codigo} <span className="text-muted-foreground font-normal">— {r.nome}</span>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{r.gerente}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.funcUteis}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.valorUteis)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.funcFds}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.valorFds)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.refeicao)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-green-600">
                      {formatBRL(r.executado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
