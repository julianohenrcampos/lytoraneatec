/**
 * Meus Chamados — listagem real de Chamados Internos.
 * Filtros: busca, status, setor, prioridade e "somente críticos".
 * Realtime via useChamadosInternosRealtime.
 * Zero DML direto (leitura respeita RLS).
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { CirclePlus, Filter, LifeBuoy, Loader2, Search, X } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  useChamadosInternosLista,
  useChamadoInternoEnriquecimento,
} from "@/hooks/useChamadosInternos";
import { useChamadosInternosRealtime } from "@/hooks/useChamadosInternosRealtime";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { primeiroNome } from "@/utils/primeiroNome";

import {
  StatusBadge,
  PrioridadeBadge,
  SetorBadge,
  formatarDataHora,
  formatarPrazoRestante,
} from "@/components/chamados-internos/StatusBadges";
import {
  CHAMADO_INTERNO_STATUS_META,
  CHAMADO_INTERNO_SETOR_META,
  CHAMADO_INTERNO_PRIORIDADE_META,
} from "@/constants/chamadosInternos";
import type {
  ChamadoInternoPrioridade,
  ChamadoInternoSetor,
  ChamadoInternoStatus,
  ChamadosInternosListaFiltro,
} from "@/types/chamadosInternos";

const STATUS_ORDER = (Object.entries(CHAMADO_INTERNO_STATUS_META) as Array<
  [ChamadoInternoStatus, { label: string; ordem: number }]
>).sort((a, b) => a[1].ordem - b[1].ordem);

const SETOR_ORDER = (Object.entries(CHAMADO_INTERNO_SETOR_META) as Array<
  [ChamadoInternoSetor, { label: string; ordem: number }]
>).sort((a, b) => a[1].ordem - b[1].ordem);

const PRIORIDADE_ORDER = (Object.entries(CHAMADO_INTERNO_PRIORIDADE_META) as Array<
  [ChamadoInternoPrioridade, { label: string; ordem: number }]
>).sort((a, b) => a[1].ordem - b[1].ordem);

const ChamadosInternosList: React.FC = () => {
  usePageTitle("Meus Chamados");
  const navigate = useNavigate();
  useChamadosInternosRealtime();

  const [busca, setBusca] = React.useState("");
  const [buscaDebounce, setBuscaDebounce] = React.useState("");
  const [status, setStatus] = React.useState<ChamadoInternoStatus | "todos">("todos");
  const [setor, setSetor] = React.useState<ChamadoInternoSetor | "todos">("todos");
  const [prioridade, setPrioridade] = React.useState<ChamadoInternoPrioridade | "todos">("todos");
  const [soloCriticos, setSoloCriticos] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setBuscaDebounce(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const filtro: ChamadosInternosListaFiltro = React.useMemo(
    () => ({
      status: status === "todos" ? undefined : [status],
      setor: setor === "todos" ? undefined : [setor],
      prioridade: prioridade === "todos" ? undefined : [prioridade],
      soloCriticos: soloCriticos || undefined,
      busca: buscaDebounce || undefined,
    }),
    [status, setor, prioridade, soloCriticos, buscaDebounce],
  );

  const q = useChamadosInternosLista(filtro);
  const rows = React.useMemo(() => q.data ?? [], [q.data]);

  // Paginação client-side (25/pág). O enriquecimento só busca a página visível.
  const pagination = usePagination(rows, { pageSize: 25 });
  const pageRows = pagination.paginatedData;
  const idsPagina = React.useMemo(() => pageRows.map((r) => r.id), [pageRows]);
  const { mapa: extras } = useChamadoInternoEnriquecimento(idsPagina);

  const limparFiltros = () => {
    setBusca("");
    setStatus("todos");
    setSetor("todos");
    setPrioridade("todos");
    setSoloCriticos(false);
    pagination.setPage(0);
  };


  const kpis = React.useMemo(() => {
    const abertos = rows.filter((r) =>
      ["aberto", "em_triagem", "em_analise", "reaberto"].includes(r.status),
    ).length;
    const aguardando = rows.filter((r) => r.status === "aguardando_solicitante").length;
    const resolvidos = rows.filter((r) => r.status === "resolvido").length;
    const criticos = rows.filter((r) => r.is_critico).length;
    return { total: rows.length, abertos, aguardando, resolvidos, criticos };
  }, [rows]);

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-primary" />
                Meus Chamados
              </CardTitle>
              <CardDescription>
                Chamados internos que você abriu ou aos quais possui acesso.
              </CardDescription>
            </div>
            <Button onClick={() => navigate("/chamados-internos/abrir")}>
              <CirclePlus className="mr-2 h-4 w-4" /> Novo chamado
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Kpi label="Total" valor={kpis.total} />
              <Kpi label="Em aberto" valor={kpis.abertos} destaque />
              <Kpi label="Aguard. solicitante" valor={kpis.aguardando} />
              <Kpi label="Resolvidos" valor={kpis.resolvidos} />
              <Kpi label="Críticos" valor={kpis.criticos} critico />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Filter className="h-4 w-4" /> Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1 md:col-span-1">
                  <Label htmlFor="busca">Busca</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="busca"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-8"
                      placeholder="Protocolo ou título"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {STATUS_ORDER.map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Setor</Label>
                  <Select value={setor} onValueChange={(v) => setSetor(v as typeof setor)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {SETOR_ORDER.map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Prioridade</Label>
                  <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {PRIORIDADE_ORDER.map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 md:col-span-3">
                  <Checkbox
                    id="soloCriticos"
                    checked={soloCriticos}
                    onCheckedChange={(c) => setSoloCriticos(c === true)}
                  />
                  <Label htmlFor="soloCriticos" className="cursor-pointer text-sm">
                    Somente críticos
                  </Label>
                </div>
                <div className="md:col-span-1 md:justify-self-end">
                  <Button variant="outline" size="sm" onClick={limparFiltros}>
                    <X className="mr-2 h-4 w-4" /> Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-md border">
              {q.isLoading ? (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando chamados...
                </div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum chamado encontrado no seu escopo de gestão com os
                  filtros atuais.
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Protocolo</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>SLA</TableHead>
                          <TableHead>Atualizado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((r) => {
                          const ex = extras.get(r.id);
                          const encerrado = r.status === "encerrado";
                          return (
                            <TableRow
                              key={r.id}
                              className={
                                "cursor-pointer " +
                                (encerrado
                                  ? "bg-success/10 hover:bg-success/20 border-l-2 border-success"
                                  : "")
                              }
                              onClick={() => navigate(`/chamados-internos/${r.id}`)}
                            >
                              <TableCell className="align-top font-mono text-xs">
                                {r.protocolo}
                                {ex?.centro_custo_codigo && (
                                  <div className="mt-0.5 font-sans text-[11px] text-muted-foreground">
                                    CC {ex.centro_custo_codigo}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="max-w-md align-top">
                                <div className="truncate">{r.titulo}</div>
                                {ex?.solicitante_nome && (
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    por: {primeiroNome(ex.solicitante_nome)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="align-top"><StatusBadge status={r.status} /></TableCell>
                              <TableCell className="align-top"><SetorBadge setor={r.setor} /></TableCell>
                              <TableCell className="align-top"><PrioridadeBadge prioridade={r.prioridade} /></TableCell>
                              <TableCell className="align-top text-xs text-muted-foreground">
                                {formatarPrazoRestante(r.sla_prazo)}
                              </TableCell>
                              <TableCell className="align-top text-xs text-muted-foreground">
                                {formatarDataHora(r.updated_at ?? r.created_at)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="grid gap-2 p-2 md:hidden">
                    {pageRows.map((r) => {
                      const ex = extras.get(r.id);
                      const encerrado = r.status === "encerrado";
                      return (
                        <button
                          key={r.id}
                          onClick={() => navigate(`/chamados-internos/${r.id}`)}
                          className={
                            "rounded-md border p-3 text-left " +
                            (encerrado ? "border-success/40 bg-success/10" : "bg-card")
                          }
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {r.protocolo}
                              {ex?.centro_custo_codigo && ` · CC ${ex.centro_custo_codigo}`}
                            </span>
                            <StatusBadge status={r.status} />
                          </div>
                          <div className="text-sm font-medium">{r.titulo}</div>
                          {ex?.solicitante_nome && (
                            <div className="text-[11px] text-muted-foreground">
                              por: {primeiroNome(ex.solicitante_nome)}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <SetorBadge setor={r.setor} />
                            <PrioridadeBadge prioridade={r.prioridade} />
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {formatarPrazoRestante(r.sla_prazo)} · {formatarDataHora(r.updated_at ?? r.created_at)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t p-2">
                    <TablePagination pagination={pagination} />
                  </div>
                </>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

const Kpi: React.FC<{ label: string; valor: number; destaque?: boolean; critico?: boolean }> = ({
  label,
  valor,
  destaque,
  critico,
}) => (
  <div className="rounded-lg border bg-card p-3">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div
      className={
        "mt-1 text-2xl font-bold " +
        (critico ? "text-destructive" : destaque ? "text-primary" : "text-foreground")
      }
    >
      {valor}
    </div>
  </div>
);

export default ChamadosInternosList;
