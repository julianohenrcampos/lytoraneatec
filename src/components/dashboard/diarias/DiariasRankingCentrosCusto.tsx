import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcularBreakdownDiaria } from "@/utils/diariaCalculo";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DiariasFilters } from "./DashboardDiariasFilters";
import {
  buildSolIdSet,
  calcularEstimadoCorrigidoTotal,
  classificarDia,
  fetchFeriadosSet,
  fetchPresencasConfirmadas,
  fetchSolicitacoesFiltradas,
  formatBRL,
} from "./_dashboardHelpers";

interface Props {
  filters: DiariasFilters;
}

interface CCRow {
  centro_custo_id: string;
  codigo: string;
  nome: string;
  gerente: string;
  funcUteis: number;
  valorUteis: number;
  funcFds: number;
  valorFds: number;
  refeicao: number;
  executado: number;
  estimado: number;
  diferenca: number;
}

export default function DiariasRankingCentrosCusto({ filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["diarias-ranking-cc-v2", filters],
    queryFn: async (): Promise<CCRow[]> => {
      const solIdSet = await buildSolIdSet(filters);
      if (solIdSet !== null && solIdSet.size === 0) return [];

      const [presencas, solicitacoes, feriados] = await Promise.all([
        fetchPresencasConfirmadas(filters, solIdSet),
        fetchSolicitacoesFiltradas(filters),
        fetchFeriadosSet(),
      ]);

      const refDate = filters.dataInicio || new Date();
      const { porCc: estimadoCorrigidoPorCc } = await calcularEstimadoCorrigidoTotal(
        solicitacoes,
        refDate
      );

      const ccIds = Array.from(
        new Set<string>(
          [
            ...presencas.map((p) => p.centro_custo_id).filter(Boolean) as string[],
            ...solicitacoes.map((s) => s.centro_custo_id).filter(Boolean) as string[],
          ]
        )
      );

      const ccMeta = new Map<string, { codigo: string; nome: string; gerente: string }>();
      if (ccIds.length > 0) {
        const { data: ccs } = await supabase
          .from("bd_centros_custo")
          .select(
            "id, codigo_centro_custo, nome_centro_custo, bd_funcionarios:bd_centros_custo_aprovador_diarias_id_fkey(nome_completo)"
          )
          .in("id", ccIds);
        (ccs || []).forEach((cc: any) => {
          ccMeta.set(cc.id, {
            codigo: cc.codigo_centro_custo,
            nome: cc.nome_centro_custo,
            gerente: cc.bd_funcionarios?.nome_completo || "—",
          });
        });
      }

      // Agrupar presenças por CC + por categoria de dia
      const map = new Map<string, CCRow>();
      const funcUteisSet = new Map<string, Set<string>>();
      const funcFdsSet = new Map<string, Set<string>>();

      const ensureRow = (id: string): CCRow => {
        let r = map.get(id);
        if (!r) {
          const meta = ccMeta.get(id);
          r = {
            centro_custo_id: id,
            codigo: meta?.codigo || "?",
            nome: meta?.nome || "?",
            gerente: meta?.gerente || "—",
            funcUteis: 0,
            valorUteis: 0,
            funcFds: 0,
            valorFds: 0,
            refeicao: 0,
            executado: 0,
            estimado: 0,
            diferenca: 0,
          };
          map.set(id, r);
          funcUteisSet.set(id, new Set());
          funcFdsSet.set(id, new Set());
        }
        return r;
      };

      for (const p of presencas) {
        if (!p.centro_custo_id || !p.data) continue;
        const r = ensureRow(p.centro_custo_id);
        const b = calcularBreakdownDiaria({
          tipo_diaria: p.tipo_diaria,
          valor_diaria_aplicada: p.valor_diaria_aplicada,
          valor_refeicao_aplicado: p.valor_refeicao_aplicado,
        });
        const cat = classificarDia(p.data, feriados);
        if (cat === "uteis") {
          r.valorUteis += b.diaria + b.meia;
          if (p.funcionario_id) funcUteisSet.get(p.centro_custo_id)?.add(p.funcionario_id);
        } else {
          r.valorFds += b.diaria + b.meia;
          if (p.funcionario_id) funcFdsSet.get(p.centro_custo_id)?.add(p.funcionario_id);
        }
        r.refeicao += b.refeicao;
        r.executado += b.total;
      }

      // Solicitações: garante linhas mesmo sem execução + estimado bruto fallback
      for (const s of solicitacoes) {
        if (!s.centro_custo_id) continue;
        ensureRow(s.centro_custo_id);
      }

      // Aplica estimado corrigido + finaliza contagens
      for (const r of map.values()) {
        r.funcUteis = funcUteisSet.get(r.centro_custo_id)?.size || 0;
        r.funcFds = funcFdsSet.get(r.centro_custo_id)?.size || 0;
        r.estimado = estimadoCorrigidoPorCc.get(r.centro_custo_id) || 0;
        r.diferenca = r.executado - r.estimado;
      }

      return Array.from(map.values())
        .sort((a, b) => b.executado - a.executado)
        .slice(0, 10);
    },
  });

  const chartData = (data || []).map((r) => ({
    name: r.codigo,
    fullName: `${r.codigo} - ${r.nome}`,
    "Dias Úteis": Math.round(r.valorUteis),
    "FDS/Feriados": Math.round(r.valorFds),
    Refeições: Math.round(r.refeicao),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Centros de Custo por Valor Executado</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Sem dados suficientes no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 32)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatBRL(v)} />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatBRL(value)}
                  labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label}
                />
                <Legend />
                <Bar dataKey="Dias Úteis" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="FDS/Feriados" stackId="a" fill="hsl(var(--primary) / 0.55)" />
                <Bar dataKey="Refeições" stackId="a" fill="hsl(var(--muted-foreground) / 0.5)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tabela Executiva — Centros de Custo</CardTitle>
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
                    <th className="text-left py-2 px-2 font-medium">Centro de Custo</th>
                    <th className="text-left py-2 px-2 font-medium">Gerente Regional</th>
                    <th className="text-right py-2 px-2 font-medium">Func. Úteis</th>
                    <th className="text-right py-2 px-2 font-medium">Valor Úteis</th>
                    <th className="text-right py-2 px-2 font-medium">Func. FDS/Fer.</th>
                    <th className="text-right py-2 px-2 font-medium">Valor FDS/Fer.</th>
                    <th className="text-right py-2 px-2 font-medium">Refeições</th>
                    <th className="text-right py-2 px-2 font-medium">Executado</th>
                    <th className="text-right py-2 px-2 font-medium">Estimado</th>
                    <th className="text-right py-2 px-2 font-medium">Diferença</th>
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
                      <td className="py-2 px-2 text-right tabular-nums font-medium">{formatBRL(r.executado)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{formatBRL(r.estimado)}</td>
                      <td
                        className={`py-2 px-2 text-right tabular-nums font-medium ${
                          r.diferenca > 0 ? "text-primary" : "text-green-600"
                        }`}
                      >
                        {r.diferenca >= 0 ? "+" : ""}
                        {formatBRL(r.diferenca)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
