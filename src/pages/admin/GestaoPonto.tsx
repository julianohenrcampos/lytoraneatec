import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Download, FileText, Filter, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import MainLayout from "@/components/layout/MainLayout";
import ModalDetalheJornada from "@/components/admin/gestao-ponto/ModalDetalheJornada";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { Label } from "@/components/ui/label";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  defaultFiltersThisMonth,
  formatData,
  formatMinutos,
  type JornadaDiariaRow,
  useJornadasDiarias,
} from "@/hooks/admin/useJornadasDiarias";
import { useCentrosCustoQuery } from "@/hooks/useCentrosCustoQuery";
import { usePermission } from "@/hooks/usePermission";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  auditPontoAccess,
  canSeeSensitivePontoData,
  getCurrentPontoReportContext,
  getPontoBatidasViewForContext,
  sanitizePontoFilters,
} from "@/services/ponto/secureAccess";
import {
  gerarPdfPontoEletronico,
  type PontoEletronicoReportData,
} from "@/utils/pdf/gerarPdfPontoEletronico";

const statusConfig = {
  real: { label: "OK", variant: "default" as const, className: "bg-primary text-primary-foreground" },
  automatico: { label: "Auto", variant: "secondary" as const, className: "" },
  sem_intervalo: { label: "S/ Int.", variant: "outline" as const, className: "" },
  incompleto: { label: "Incompleto", variant: "destructive" as const, className: "" },
  inconsistente: { label: "Inconsist.", variant: "destructive" as const, className: "" },
};

const fmtHHMM = (minutes: number) => {
  if (!minutes || minutes <= 0) return "00:00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const weekdayLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(
    parse(date, "yyyy-MM-dd", new Date())
  );

const GestaoPonto: React.FC = () => {
  usePageTitle("Gestão de Ponto");

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
  const { user } = useUserProfile();
  const { permissions, isSuperAdmin } = usePermission();

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
  const canExport = isSuperAdmin || permissions.includes("ponto_relatorios");

  const funcionarioOptions = useMemo(
    () => [
      { value: "", label: "Todos" },
      ...((funcionarios || []).map((f: any) => ({
        value: f.id,
        label: `${f.nome_completo}${f.matricula ? ` (${f.matricula})` : ""}`,
      }))),
    ],
    [funcionarios]
  );

  const centroCustoOptions = useMemo(
    () =>
      (centrosCusto || []).map((c) => ({
        value: c.id,
        label: `${c.codigo_centro_custo ?? "—"} - ${c.nome_centro_custo}`,
      })),
    [centrosCusto]
  );

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

  const exportarPdf = async () => {
    if (!canExport) {
      toast.error("Você não tem permissão para exportar relatórios de ponto.");
      return;
    }

    if (!jornadas?.length) {
      toast.error("Não há jornadas para exportar.");
      return;
    }

    try {
      const context = await getCurrentPontoReportContext();
      const batidasView = getPontoBatidasViewForContext(context);
      const canSeeSensitive = canSeeSensitivePontoData(context);
      const funcionarioIds = Array.from(new Set(jornadas.map((j) => j.funcionarioId)));
      const datas = Array.from(new Set(jornadas.map((j) => j.dataOperacional)));

      const { data: batidasRaw, error } = await (supabase
        .from(batidasView as any)
        .select("funcionario_id, data_operacional, tipo_batida, data_hora_considerada, status_validacao")
        .in("funcionario_id", funcionarioIds)
        .in("data_operacional", datas)
        .neq("status_validacao", "invalidada")
        .order("data_hora_considerada", { ascending: true }) as any);

      if (error) throw error;
      const batidas = (batidasRaw || []) as Array<{
        funcionario_id: string;
        data_operacional: string;
        tipo_batida: string | null;
        data_hora_considerada: string;
      }>;

      const batidasMap = new Map<string, Array<{ tipo_batida: string | null; data_hora_considerada: string }>>();
      for (const batida of batidas) {
        const key = `${batida.funcionario_id}|${batida.data_operacional}`;
        const items = batidasMap.get(key) || [];
        items.push({
          tipo_batida: batida.tipo_batida,
          data_hora_considerada: batida.data_hora_considerada,
        });
        batidasMap.set(key, items);
      }

      const byEmployee = new Map<string, JornadaDiariaRow[]>();
      for (const jornada of jornadas) {
        const items = byEmployee.get(jornada.funcionarioId) || [];
        items.push(jornada);
        byEmployee.set(jornada.funcionarioId, items);
      }

        const reports: PontoEletronicoReportData[] = Array.from(byEmployee.values()).map((rows) => {
        const employee = rows[0];
          const totalHorasDiurnasMin = rows.reduce((acc, row) => {
            const horasNoturnasMin = row.tipo_escala === "12x36" ? Math.min(row.tempo_liquido_min, 120) : 0;
            return acc + Math.max(0, row.tempo_liquido_min - horasNoturnasMin);
          }, 0);
          const totalHorasNoturnasMin = rows.reduce(
            (acc, row) => acc + (row.tipo_escala === "12x36" ? Math.min(row.tempo_liquido_min, 120) : 0),
            0
          );
          const totalHeNoturnasMin = rows.reduce(
            (acc, row) => acc + (row.tipo_escala === "12x36" ? Math.min(row.horas_extras_min, 60) : 0),
            0
          );
          const totalHeDiurnasMin = rows.reduce((acc, row) => {
            const heNoturnasMin = row.tipo_escala === "12x36" ? Math.min(row.horas_extras_min, 60) : 0;
            return acc + Math.max(0, row.horas_extras_min - heNoturnasMin);
          }, 0);
          const totalHorasMin = rows.reduce((acc, row) => acc + row.tempo_liquido_min, 0);
          const totalExtrasMin = rows.reduce((acc, row) => acc + row.horas_extras_min, 0);
          const totalAtrasosMin = rows.reduce((acc, row) => acc + row.atraso_min, 0);

        const horasPorEscala = rows.reduce<Record<string, number>>((acc, row) => {
          const key = row.tipo_escala || "Não informada";
          acc[key] = (acc[key] || 0) + row.tempo_liquido_min;
          return acc;
        }, {});

        const horasPorDiaSemana = rows.reduce<Record<string, number>>((acc, row) => {
          const key = weekdayLabel(row.dataOperacional);
          acc[key] = (acc[key] || 0) + row.tempo_liquido_min;
          return acc;
        }, {});

        const ocorrencias = rows.reduce<Record<string, number>>((acc, row) => {
          const key = row.tipo_calculo === "inconsistente" || row.tipo_calculo === "incompleto"
            ? "Inconsistências"
            : row.tipo_calculo === "automatico"
              ? "Intervalo automático"
              : row.tempo_liquido_min <= 0
                ? "Folgas"
                : "Registros OK";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        return {
          employee: {
            empresa: employee.empresa_nome || "—",
            cnpj: employee.empresa_cnpj || "—",
            colaborador: employee.funcionario_nome,
            cpf: canSeeSensitive ? employee.funcionario_cpf || "—" : "***.***.***-**",
            cargo: employee.funcao || "—",
            admissao: employee.data_admissao
              ? format(parse(employee.data_admissao, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")
              : "—",
            departamento: employee.departamento_nome || "—",
            periodo: `${format(parse(aplicado.dataInicio, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")} a ${format(parse(aplicado.dataFim, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}`,
          },
          generatedAt: new Date().toLocaleString("pt-BR"),
          generatedBy: user?.nome_completo || user?.email || "Usuário do sistema",
          rows: rows.map((row) => {
            const key = `${row.funcionarioId}|${row.dataOperacional}`;
            const dayBatidas = batidasMap.get(key) || [];
            const getIso = (tipo: string) => dayBatidas.find((b) => b.tipo_batida === tipo)?.data_hora_considerada;
            const hora = (iso?: string) => (iso ? format(new Date(iso), "HH:mm") : null);
            const entrada = hora(getIso("entrada"));
            const intInicio = hora(getIso("intervalo_inicio"));
            const intFim = hora(getIso("intervalo_fim"));
            const saida = hora(getIso("saida"));
            const jornada1 = entrada && (intInicio || saida) ? `${entrada}–${intInicio || saida}` : null;
            const jornada2 = intFim && saida ? `${intFim}–${saida}` : null;
            const realizado = [jornada1, jornada2].filter(Boolean).join(" / ") || [entrada, saida].filter(Boolean).join("–") || "Folga";
            const horasNoturnasMin = row.tipo_escala === "12x36" ? Math.min(row.tempo_liquido_min, 120) : 0;
            const heNoturnasMin = row.tipo_escala === "12x36" ? Math.min(row.horas_extras_min, 60) : 0;

            return {
              data: formatData(row.dataOperacional),
              previsto: row.tipo_escala === "12x36" ? "12:00" : "08:00",
              interjornada: row.tipo_escala === "12x36" ? "36:00" : "16:00",
              realizado,
              intrajornada: row.intervalo_inicio && row.intervalo_fim
                ? `${row.intervalo_inicio}–${row.intervalo_fim}`
                : row.tipo_calculo === "automatico"
                  ? "12:00–13:00"
                  : "—",
              horasDiurnas: fmtHHMM(Math.max(0, row.tempo_liquido_min - horasNoturnasMin)),
              horasNoturnas: fmtHHMM(horasNoturnasMin),
              horasTotais: formatMinutos(row.tempo_liquido_min),
              heDiurnas: fmtHHMM(Math.max(0, row.horas_extras_min - heNoturnasMin)),
              heNoturnas: fmtHHMM(heNoturnasMin),
              heTotais: formatMinutos(row.horas_extras_min),
              horasTrabalhadas: formatMinutos(row.tempo_liquido_min),
              atraso: formatMinutos(row.atraso_min),
              isFolga: row.tempo_liquido_min <= 0 && row.batidas_count === 0,
              ocorrencia: statusConfig[row.tipo_calculo].label,
            };
          }),
            totals: {
              horasDiurnas: fmtHHMM(totalHorasDiurnasMin),
              horasNoturnas: fmtHHMM(totalHorasNoturnasMin),
              horasTotais: formatMinutos(totalHorasMin),
              heDiurnas: fmtHHMM(totalHeDiurnasMin),
              heNoturnas: fmtHHMM(totalHeNoturnasMin),
              heTotais: formatMinutos(totalExtrasMin),
              horasTrabalhadas: formatMinutos(totalHorasMin),
              atraso: formatMinutos(totalAtrasosMin),
            },
          summaries: {
              highlights: [
                { label: "Total atrasos", value: formatMinutos(totalAtrasosMin) },
                { label: "Total horas noturnas", value: fmtHHMM(totalHorasNoturnasMin) },
                { label: "Total escala", value: formatMinutos(totalHorasMin) },
                { label: "Horas extras acumuladas", value: formatMinutos(totalExtrasMin) },
                { label: "Banco de horas", value: fmtHHMM(rows.reduce((acc, row) => acc + row.horas_extras_min - row.atraso_min, 0)) },
              ],
            horasPorEscala: Object.entries(horasPorEscala).map(([label, total]) => ({ label, value: formatMinutos(total) })),
            horasPorDiaSemana: Object.entries(horasPorDiaSemana).map(([label, total]) => ({ label, value: formatMinutos(total) })),
            ocorrencias: Object.entries(ocorrencias).map(([label, total]) => ({ label, value: String(total) })),
          },
            signatures: {
              employee: employee.funcionario_nome,
              company: employee.empresa_nome || "LYTOTEC",
            },
            legend:
              "Legenda: (M) Marcação (A) Ajuste Manual (AB) Abono Parcial (AT) Atestado Parcial (HE) Horas extras (BH) Banco de horas (JH) Jornada híbrida",
        };
      });

      await gerarPdfPontoEletronico(reports);
      await auditPontoAccess({
        context,
        tipoAcesso: "exportacao_pdf",
        recurso: "relatorio_ponto_eletronico",
        filtros: sanitizePontoFilters(aplicado),
        quantidadeRegistros: jornadas.length,
        origem: "gestao_ponto",
        funcionarioId: aplicado.funcionarioId,
        detalhes: { visao: batidasView, exportado_por: user?.id ?? null },
      });
      toast.success("Relatório gerado com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar o relatório.");
    }
  };

  React.useEffect(() => {
    if (!jornadas) return;
    void (async () => {
      const context = await getCurrentPontoReportContext();
      await auditPontoAccess({
        context,
        tipoAcesso: "consulta",
        recurso: "gestao_ponto_jornadas",
        filtros: sanitizePontoFilters(aplicado),
        quantidadeRegistros: jornadas.length,
        origem: "gestao_ponto",
        funcionarioId: aplicado.funcionarioId,
      });
    })();
  }, [jornadas, aplicado]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Auditoria completa de jornada, inconsistências e exportação corporativa.
            </p>
          </div>
          <Button onClick={exportarPdf} disabled={!jornadas?.length || isLoading || !canExport} className="gap-2" title={canExport ? "" : "Sem permissão para exportar"}>
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <Combobox
                  options={funcionarioOptions}
                  value={funcionarioId}
                  onChange={setFuncionarioId}
                  placeholder="Todos"
                  searchPlaceholder="Buscar funcionário..."
                  emptyText="Nenhum funcionário encontrado"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Centro de Custo</Label>
                <MultiCombobox
                  options={centroCustoOptions}
                  value={ccIds}
                  onChange={setCcIds}
                  placeholder="Todos"
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro de custo encontrado"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Período</Label>
                <DatePickerWithRange value={dateRange} onChange={setDateRange} />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={aplicarFiltros} className="gap-2">
                <FileText className="h-4 w-4" />
                Aplicar filtros
              </Button>
              <Button variant="outline" onClick={limparFiltros} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Limpar
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
                  <TableHead className="text-center">Entrada</TableHead>
                  <TableHead className="text-center">Início Int.</TableHead>
                  <TableHead className="text-center">Fim Int.</TableHead>
                  <TableHead className="text-center">Saída</TableHead>
                  <TableHead className="text-center">Hrs Trab.</TableHead>
                  <TableHead className="text-center">Hrs Extras</TableHead>
                  <TableHead className="text-center">Atrasos</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center">Carregando...</TableCell>
                  </TableRow>
                )}

                {!isLoading && (jornadas || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                      Nenhuma jornada encontrada para os filtros selecionados
                    </TableCell>
                  </TableRow>
                )}

                {(jornadas || []).map((j) => {
                  const inconsistente = j.tipo_calculo === "inconsistente" || j.tipo_calculo === "incompleto";
                  const status = statusConfig[j.tipo_calculo];

                  return (
                    <TableRow
                      key={`${j.funcionarioId}-${j.dataOperacional}`}
                      className={`cursor-pointer hover:bg-muted/50 ${inconsistente ? "bg-amber-50/70 dark:bg-amber-950/20" : ""}`}
                      onClick={() => setDetalhe(j)}
                    >
                      <TableCell className="font-mono text-xs">{formatData(j.dataOperacional)}</TableCell>
                      <TableCell>
                        <div className="font-medium leading-tight">{j.funcionario_nome}</div>
                        <div className="text-xs text-muted-foreground leading-tight">
                          {[j.centro_custo_codigo, j.centro_custo_nome].filter(Boolean).join(" - ") || "Sem centro de custo"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{j.entrada ?? "—"}</TableCell>
                      <TableCell className="text-center font-mono">{j.intervalo_inicio ?? "—"}</TableCell>
                      <TableCell className="text-center font-mono">{j.intervalo_fim ?? "—"}</TableCell>
                      <TableCell className="text-center font-mono">{j.saida ?? "—"}</TableCell>
                      <TableCell className="text-center font-mono font-semibold">{formatMinutos(j.tempo_liquido_min)}</TableCell>
                      <TableCell className="text-center font-mono text-primary">{formatMinutos(j.horas_extras_min)}</TableCell>
                      <TableCell className="text-center font-mono text-destructive">{formatMinutos(j.atraso_min)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={status.variant} className={status.className}>{status.label}</Badge>
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
    </MainLayout>
  );
};

export default GestaoPonto;
