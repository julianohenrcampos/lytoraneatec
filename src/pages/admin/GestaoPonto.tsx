import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Filter, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCentrosCustoQuery } from "@/hooks/useCentrosCustoQuery";
import {
  useJornadasDiarias,
  formatMinutos,
  formatData,
  defaultFiltersThisMonth,
  type JornadaDiariaRow,
} from "@/hooks/admin/useJornadasDiarias";
import ModalDetalheJornada from "@/components/admin/gestao-ponto/ModalDetalheJornada";
import { format, parse } from "date-fns";
import type { DateRange } from "react-day-picker";

const GestaoPonto: React.FC = () => {
  const defaults = useMemo(() => defaultFiltersThisMonth(), []);
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parse(defaults.dataInicio, "yyyy-MM-dd", new Date()),
    to: parse(defaults.dataFim, "yyyy-MM-dd", new Date()),
  });
  const [aplicado, setAplicado] = useState({
    funcionarioId: "" as string | null,
    ccIds: [] as string[],
    dataInicio: defaults.dataInicio,
    dataFim: defaults.dataFim,
  });
  const [detalhe, setDetalhe] = useState<JornadaDiariaRow | null>(null);

  const { data: funcionarios } = useQuery({
    queryKey: ["funcionarios-ativos-gestao-ponto"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, matricula")
        .in("status", ["Ativo", "Ativo sem Registro"])
        .order("nome_completo")
        .limit(2000);
      return data || [];
    },
  });

  const { data: centrosCusto } = useCentrosCustoQuery();

  const { data: jornadas, isLoading, refetch } = useJornadasDiarias(aplicado);

  const aplicarFiltros = () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setAplicado({
      funcionarioId: funcionarioId || null,
      ccIds,
      dataInicio: format(dateRange.from, "yyyy-MM-dd"),
      dataFim: format(dateRange.to, "yyyy-MM-dd"),
    });
  };

  const limparFiltros = () => {
    setFuncionarioId("");
    setCcIds([]);
    const d = defaultFiltersThisMonth();
    setDateRange({
      from: parse(d.dataInicio, "yyyy-MM-dd", new Date()),
      to: parse(d.dataFim, "yyyy-MM-dd", new Date()),
    });
    setAplicado({ funcionarioId: null, ccIds: [], dataInicio: d.dataInicio, dataFim: d.dataFim });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gestão de Ponto</h1>
          <p className="text-sm text-muted-foreground">
            Auditoria completa de jornada de trabalho
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Funcionário</label>
            <Combobox
              options={[
                { value: "", label: "Todos" },
                ...((funcionarios || []).map((f: any) => ({
                  value: f.id,
                  label: `${f.nome_completo}${f.matricula ? ` (${f.matricula})` : ""}`,
                }))),
              ]}
              value={funcionarioId}
              onChange={setFuncionarioId}
              placeholder="Selecione"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Centros de Custo</label>
            <MultiCombobox
              options={(centrosCusto || []).map((c) => ({
                value: c.id,
                label: c.nome_centro_custo,
              }))}
              value={ccIds}
              onChange={setCcIds}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Período</label>
            <DatePickerWithRange value={dateRange} onChange={setDateRange} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={aplicarFiltros} className="flex-1">Aplicar</Button>
            <Button variant="outline" onClick={limparFiltros}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Jornadas {jornadas ? `(${jornadas.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Início Int.</TableHead>
                <TableHead>Fim Int.</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Hrs Trab.</TableHead>
                <TableHead>Hrs Extras</TableHead>
                <TableHead>Atrasos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && (jornadas || []).length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nenhuma jornada encontrada para os filtros selecionados
                </TableCell></TableRow>
              )}
              {(jornadas || []).map((j) => {
                const inconsistente = j.tipo_calculo === "inconsistente" || j.tipo_calculo === "incompleto";
                return (
                  <TableRow
                    key={`${j.funcionarioId}-${j.dataOperacional}`}
                    className={`cursor-pointer hover:bg-muted/50 ${inconsistente ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}
                    onClick={() => setDetalhe(j)}
                  >
                    <TableCell className="font-mono">{formatData(j.dataOperacional)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{j.funcionario_nome}</div>
                      {j.centro_custo_nome && (
                        <div className="text-xs text-muted-foreground">{j.centro_custo_nome}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{j.entrada ?? "—"}</TableCell>
                    <TableCell className="font-mono">{j.intervalo_inicio ?? "—"}</TableCell>
                    <TableCell className="font-mono">{j.intervalo_fim ?? "—"}</TableCell>
                    <TableCell className="font-mono">{j.saida ?? "—"}</TableCell>
                    <TableCell className="font-mono font-semibold">{formatMinutos(j.tempo_liquido_min)}</TableCell>
                    <TableCell className="font-mono text-green-700 dark:text-green-400">{formatMinutos(j.horas_extras_min)}</TableCell>
                    <TableCell className="font-mono text-destructive">{formatMinutos(j.atraso_min)}</TableCell>
                    <TableCell>
                      {j.tipo_calculo === "real" && <Badge className="bg-green-600">OK</Badge>}
                      {j.tipo_calculo === "automatico" && <Badge variant="secondary">Auto</Badge>}
                      {j.tipo_calculo === "sem_intervalo" && <Badge variant="outline">S/ Int.</Badge>}
                      {j.tipo_calculo === "incompleto" && <Badge variant="destructive">Incompleto</Badge>}
                      {j.tipo_calculo === "inconsistente" && <Badge variant="destructive">Inconsist.</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ModalDetalheJornada
        isOpen={!!detalhe}
        onClose={() => setDetalhe(null)}
        jornada={detalhe}
        onChanged={() => refetch()}
      />
    </div>
  );
};

export default GestaoPonto;
