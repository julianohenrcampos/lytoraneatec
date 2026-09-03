/**
 * Dashboard de Chamados Internos.
 *
 * Fonte única de dados: RPCs `fn_chamado_interno_dash_*` (SECURITY DEFINER),
 * que já aplicam o escopo SuperAdm / AdmSede (por CC) / Atendente (por setor).
 * O frontend não reaplica gate de segurança — apenas apresenta.
 */
import React from "react";
import { AlertTriangle, BarChart3, Filter, FilterX } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import ChamadosDashKpisGrid from "@/components/chamados-internos/dashboard/ChamadosDashKpis";
import ChamadosDashGraficos from "@/components/chamados-internos/dashboard/ChamadosDashGraficos";
import {
  AtendentesTabela,
  FilaSlaRiscoTabela,
  SolicitantesTabela,
} from "@/components/chamados-internos/dashboard/ChamadosDashTabelas";
import {
  useChamadosDashAtendentes,
  useChamadosDashFilaRisco,
  useChamadosDashKpis,
  useChamadosDashPodeVer,
  useChamadosDashSeries,
  useChamadosDashSolicitantes,
} from "@/hooks/useChamadosInternosDashboard";
import { exportarRankingSolicitantesExcel } from "@/services/excel/chamadosInternosRankingExcel";
import {
  CHAMADO_INTERNO_PRIORIDADE_META,
  CHAMADO_INTERNO_SETOR_META,
} from "@/constants/chamadosInternos";
import type {
  ChamadoInternoPrioridade,
  ChamadoInternoSetor,
} from "@/types/chamadosInternos";
import type {
  ChamadosDashFiltro,
  SlaFiltro,
} from "@/types/chamadosInternosDashboard";

const TODOS = "todos" as const;

type PeriodoPreset = "hoje" | "7d" | "30d" | "mes" | "personalizado";

function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function resolverPeriodo(
  preset: PeriodoPreset,
  deManual: string,
  ateManual: string,
): { de: string; ate: string } {
  const agora = new Date();
  const fim = new Date(inicioDoDia(agora).getTime() + 24 * 60 * 60 * 1000);

  if (preset === "personalizado" && deManual && ateManual) {
    const de = new Date(`${deManual}T00:00:00`);
    const ate = new Date(`${ateManual}T00:00:00`);
    ate.setDate(ate.getDate() + 1);
    return { de: de.toISOString(), ate: ate.toISOString() };
  }

  if (preset === "hoje") return { de: inicioDoDia(agora).toISOString(), ate: fim.toISOString() };
  if (preset === "mes") {
    const de = new Date(agora.getFullYear(), agora.getMonth(), 1);
    return { de: de.toISOString(), ate: fim.toISOString() };
  }
  const dias = preset === "7d" ? 7 : 30;
  const de = new Date(inicioDoDia(agora).getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
  return { de: de.toISOString(), ate: fim.toISOString() };
}

const SETORES = (
  Object.entries(CHAMADO_INTERNO_SETOR_META) as Array<
    [ChamadoInternoSetor, { label: string; ordem: number }]
  >
).sort((a, b) => a[1].ordem - b[1].ordem);

const PRIORIDADES = (
  Object.entries(CHAMADO_INTERNO_PRIORIDADE_META) as Array<
    [ChamadoInternoPrioridade, { label: string; ordem: number }]
  >
).sort((a, b) => a[1].ordem - b[1].ordem);

const ChamadosInternosDashboard: React.FC = () => {
  usePageTitle("Dashboard de Chamados");

  const [preset, setPreset] = React.useState<PeriodoPreset>("30d");
  const [deManual, setDeManual] = React.useState("");
  const [ateManual, setAteManual] = React.useState("");
  const [setor, setSetor] = React.useState<ChamadoInternoSetor | typeof TODOS>(TODOS);
  const [prioridade, setPrioridade] = React.useState<
    ChamadoInternoPrioridade | typeof TODOS
  >(TODOS);
  const [sla, setSla] = React.useState<SlaFiltro>("todos");
  const [responsavel, setResponsavel] = React.useState<string>(TODOS);
  const [exportando, setExportando] = React.useState(false);

  const podeVerQ = useChamadosDashPodeVer();
  const habilitado = podeVerQ.data === true;

  const periodo = React.useMemo(
    () => resolverPeriodo(preset, deManual, ateManual),
    [preset, deManual, ateManual],
  );

  const filtro: ChamadosDashFiltro = React.useMemo(
    () => ({
      de: periodo.de,
      ate: periodo.ate,
      setor: setor === TODOS ? null : [setor],
      prioridade: prioridade === TODOS ? null : [prioridade],
      responsavelProfileId: responsavel === TODOS ? null : responsavel,
      centroCustoId: null,
      sla,
    }),
    [periodo, setor, prioridade, responsavel, sla],
  );

  const kpisQ = useChamadosDashKpis(filtro, habilitado);
  const seriesQ = useChamadosDashSeries(filtro, habilitado);
  const atendentesQ = useChamadosDashAtendentes(filtro, habilitado);
  const filaQ = useChamadosDashFilaRisco(filtro, habilitado);
  const solicitantesQ = useChamadosDashSolicitantes(filtro, habilitado);

  const filtrosAtivos =
    preset !== "30d" ||
    setor !== TODOS ||
    prioridade !== TODOS ||
    sla !== "todos" ||
    responsavel !== TODOS ||
    !!deManual ||
    !!ateManual;

  const limparFiltros = () => {
    setPreset("30d");
    setDeManual("");
    setAteManual("");
    setSetor(TODOS);
    setPrioridade(TODOS);
    setSla("todos");
    setResponsavel(TODOS);
  };


  const exportar = async () => {
    if (!solicitantesQ.data?.length) return;
    setExportando(true);
    try {
      await exportarRankingSolicitantesExcel(solicitantesQ.data, periodo);
      toast.success("Ranking exportado em Excel");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar o ranking");
    } finally {
      setExportando(false);
    }
  };

  if (podeVerQ.isLoading) {
    return (
      <MainLayout>
        <div className="p-4 md:p-6 text-sm text-muted-foreground">Carregando painel...</div>
      </MainLayout>
    );
  }

  if (!habilitado) {
    return (
      <MainLayout>
        <div className="p-4 md:p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este painel é restrito a atendentes e administradores de Chamados Internos.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  const erro = kpisQ.error || seriesQ.error;

  return (
    <MainLayout>
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <Card>
          <CardHeader className="pb-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Filter className="h-4 w-4 text-primary" />
              Filtros do painel
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 sm:mt-0"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
            >
              <FilterX className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>

          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Período</Label>
                <Select
                  value={preset}
                  onValueChange={(v) => setPreset(v as PeriodoPreset)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="mes">Mês atual</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select
                  value={setor}
                  onValueChange={(v) => setSetor(v as ChamadoInternoSetor | typeof TODOS)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os setores</SelectItem>
                    {SETORES.map(([valor, meta]) => (
                      <SelectItem key={valor} value={valor}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={prioridade}
                  onValueChange={(v) =>
                    setPrioridade(v as ChamadoInternoPrioridade | typeof TODOS)
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todas</SelectItem>
                    {PRIORIDADES.map(([valor, meta]) => (
                      <SelectItem key={valor} value={valor}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status\u00a0</Label>
                <Select value={sla} onValueChange={(v) => setSla(v as SlaFiltro)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="no_prazo">No prazo</SelectItem>
                    <SelectItem value="a_vencer">Próximo do vencimento (&lt; 2h)</SelectItem>
                    <SelectItem value="estourado">Estourado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preset === "personalizado" && (
                <>
                  <div className="space-y-1.5">
                    <Label>De</Label>
                    <Input
                      type="date"
                      value={deManual}
                      onChange={(e) => setDeManual(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Até</Label>
                    <Input
                      type="date"
                      value={ateManual}
                      onChange={(e) => setAteManual(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label>Atendente responsável</Label>
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos</SelectItem>
                    {(atendentesQ.data ?? []).map((a) => (
                      <SelectItem key={a.atendente_profile_id} value={a.atendente_profile_id}>
                        {a.atendente_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {erro ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Não foi possível carregar os indicadores. Tente atualizar o painel.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            Indicadores principais
          </h2>
          <ChamadosDashKpisGrid kpis={kpisQ.data} isLoading={kpisQ.isLoading} />
        </section>

        <ChamadosDashGraficos series={seriesQ.data} isLoading={seriesQ.isLoading} />

        <FilaSlaRiscoTabela
          linhas={filaQ.data}
          isLoading={filaQ.isLoading}
          isError={filaQ.isError}
          erroMensagem={filaQ.error instanceof Error ? filaQ.error.message : undefined}
          onTentarNovamente={() => void filaQ.refetch()}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <AtendentesTabela linhas={atendentesQ.data} isLoading={atendentesQ.isLoading} />
          <SolicitantesTabela
            linhas={solicitantesQ.data}
            isLoading={solicitantesQ.isLoading}
            isExportando={exportando}
            onExportar={() => void exportar()}
          />
        </div>
      </div>
    </MainLayout>
  );
};

export default ChamadosInternosDashboard;
