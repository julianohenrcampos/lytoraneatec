import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { calcularBreakdownDiaria } from "@/utils/diariaCalculo";
import { DiariasFilters } from "./DashboardDiariasFilters";
import {
  buildSolIdSet,
  classificarDia,
  fetchFeriadosSet,
  fetchPresencasConfirmadas,
  fetchSolicitacoesFiltradas,
  formatBRL,
} from "./_dashboardHelpers";

interface Props {
  filters: DiariasFilters;
}

interface FuncRow {
  funcao_id: string;
  nome: string;
  convocados: number;
  apontUteis: number;
  apontFds: number;
  valorUteis: number;
  valorFds: number;
  refeicao: number;
  total: number;
  pct: number;
}

export default function DiariasRankingFuncoes({ filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["diarias-ranking-funcoes-v2", filters],
    queryFn: async (): Promise<FuncRow[]> => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0) return [];

      const [presencas, solicitacoes, feriados] = await Promise.all([
        fetchPresencasConfirmadas(filters, solIdSet),
        fetchSolicitacoesFiltradas(filters),
        fetchFeriadosSet(),
      ]);

      const map = new Map<
        string,
        {
          nome: string;
          convocadosSet: Set<string>;
          apontUteisSet: Set<string>;
          apontFdsSet: Set<string>;
          valorUteis: number;
          valorFds: number;
          refeicao: number;
          total: number;
        }
      >();

      const ensure = (id: string, nome: string) => {
        if (!map.has(id)) {
          map.set(id, {
            nome,
            convocadosSet: new Set(),
            apontUteisSet: new Set(),
            apontFdsSet: new Set(),
            valorUteis: 0,
            valorFds: 0,
            refeicao: 0,
            total: 0,
          });
        }
        return map.get(id)!;
      };

      // Convocados (vindos do JSON convocados_pre)
      for (const s of solicitacoes) {
        const conv = Array.isArray(s.convocados_pre) ? s.convocados_pre : [];
        for (const c of conv) {
          const id = c.funcao_id || "__sem_funcao__";
          const nome = c.nome_funcao || "Sem função";
          const r = ensure(id, nome);
          if (c.funcionario_id) r.convocadosSet.add(c.funcionario_id);
        }
      }

      // Apontados (executados)
      let grandTotal = 0;
      for (const p of presencas) {
        if (!p.data) continue;
        const id = p.funcao_id || "__sem_funcao__";
        const nome = p.nome_funcao || "Sem função";
        const r = ensure(id, nome);
        const b = calcularBreakdownDiaria({
          tipo_diaria: p.tipo_diaria,
          valor_diaria_aplicada: p.valor_diaria_aplicada,
          valor_refeicao_aplicado: p.valor_refeicao_aplicado,
        });
        const cat = classificarDia(p.data, feriados);
        if (cat === "uteis") {
          r.valorUteis += b.diaria + b.meia;
          if (p.funcionario_id) r.apontUteisSet.add(p.funcionario_id);
        } else {
          r.valorFds += b.diaria + b.meia;
          if (p.funcionario_id) r.apontFdsSet.add(p.funcionario_id);
        }
        r.refeicao += b.refeicao;
        r.total += b.total;
        grandTotal += b.total;
      }

      return Array.from(map.entries())
        .map(([funcao_id, r]) => ({
          funcao_id,
          nome: r.nome,
          convocados: r.convocadosSet.size,
          apontUteis: r.apontUteisSet.size,
          apontFds: r.apontFdsSet.size,
          valorUteis: r.valorUteis,
          valorFds: r.valorFds,
          refeicao: r.refeicao,
          total: r.total,
          pct: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Funções mais solicitadas no período</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados suficientes no período
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b">
                  <th className="text-left py-2 px-2 font-medium">Função / Cargo</th>
                  <th className="text-right py-2 px-2 font-medium">Convocados</th>
                  <th className="text-right py-2 px-2 font-medium">Apont. Úteis</th>
                  <th className="text-right py-2 px-2 font-medium">Valor Úteis</th>
                  <th className="text-right py-2 px-2 font-medium">Apont. FDS/Fer.</th>
                  <th className="text-right py-2 px-2 font-medium">Valor FDS/Fer.</th>
                  <th className="text-right py-2 px-2 font-medium">Refeições</th>
                  <th className="text-right py-2 px-2 font-medium">Total</th>
                  <th className="text-right py-2 px-2 font-medium">% do Total</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.funcao_id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-medium">{r.nome}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.convocados}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.apontUteis}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.valorUteis)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.apontFds}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.valorFds)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.refeicao)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{formatBRL(r.total)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, r.pct)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right">{r.pct.toFixed(1)}%</span>
                      </div>
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
