import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  classificarDia,
  formatBRL,
  type DiariasFilters,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";
import { lerConvocadosPre, derivarFuncionariosPlanos } from "@/lib/diarias/convocadosPreAdapter";

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
  const { data: ds, isLoading } = useDiariasDataset(filters);

  const data = useMemo<FuncRow[]>(() => {
    if (!ds) return [];
    const map = new Map<
      string,
      {
        nome: string;
        convocadosSet: Set<string>;
        apontUteis: number;
        apontFds: number;
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
          apontUteis: 0,
          apontFds: 0,
          valorUteis: 0,
          valorFds: 0,
          refeicao: 0,
          total: 0,
        });
      }
      return map.get(id)!;
    };

    for (const s of ds.solicitacoes) {
      const conv = derivarFuncionariosPlanos(
        lerConvocadosPre(s.convocados_pre, { inicio: s.data_inicio, fim: s.data_fim }),
      );
      for (const c of conv) {
        const id = c.funcao_id || "__sem_funcao__";
        const nome = c.nome_funcao || "Sem função";
        const r = ensure(id, nome);
        if (c.funcionario_id) r.convocadosSet.add(c.funcionario_id);
      }
    }

    let grandTotal = 0;
    for (const p of ds.presencas) {
      if (!p.data) continue;
      const id = p.funcao_id || "__sem_funcao__";
      const nome = p.nome_funcao || "Sem função";
      const r = ensure(id, nome);
      const dRef = Math.ceil(Number(p.valor_diaria_aplicada || 0));
      const rRef = Math.ceil(Number(p.valor_refeicao_aplicado || 0));
      const lineTotal = dRef + rRef;
      const cat = classificarDia(p.data, ds.feriadosSet);
      if (cat === "uteis") {
        r.valorUteis += dRef;
        r.apontUteis += 1;
      } else {
        r.valorFds += dRef;
        r.apontFds += 1;
      }
      r.refeicao += rRef;
      r.total += lineTotal;
      grandTotal += lineTotal;
    }

    return Array.from(map.entries())
      .map(([funcao_id, r]) => ({
        funcao_id,
        nome: r.nome,
        convocados: r.convocadosSet.size,
        apontUteis: r.apontUteis,
        apontFds: r.apontFds,
        valorUteis: r.valorUteis,
        valorFds: r.valorFds,
        refeicao: r.refeicao,
        total: r.total,
        pct: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [ds]);

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
        ) : data.every((r) => r.total === 0) ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Sem valores financeiros disponíveis para este perfil/contexto
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
