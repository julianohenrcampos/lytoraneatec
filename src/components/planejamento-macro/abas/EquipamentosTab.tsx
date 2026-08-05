import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ExternalLink,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TabHeader from "../shared/TabHeader";
import PaginationFooter from "../shared/PaginationFooter";
import { formatarPeriodoBR } from "../shared/formatData";
import { useSolicitacoesEquipamentoPlanejamento } from "@/hooks/useSolicitacoesEquipamentoPlanejamento";
import { useRecursosPorPlanejamento } from "@/hooks/planejamentoMacro/useRecursosPorPlanejamento";
import { useEquipamentosDisponiveisNoCC } from "@/hooks/planejamentoMacro/useEquipamentosDisponiveisNoCC";
import { isEquipamentoOperacional } from "@/lib/planejamentoMacro/planoSemanal/classificarRecurso";
import { usePagination } from "@/hooks/usePagination";
import type {
  SolicitacaoEquipamentoPlanejamentoItem,
  StatusFluxo,
} from "@/services/solicitacaoEquipamentoService";

const DEFAULT_PAGE_SIZE = 10;

interface Props {
  centroCustoId: string | null;
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (v: string) => void;
  onDataFimChange: (v: string) => void;
  planejamentoId?: string | null;
  planVigenteInicio?: string | null;
  planVigenteFim?: string | null;
}

const STATUS_FLUXO_VARIANT: Record<
  StatusFluxo,
  "default" | "secondary" | "destructive" | "outline"
> = {
  RASCUNHO: "secondary",
  PENDENTE_APROVACAO: "outline",
  APROVADO: "default",
  EM_TRANSPORTE: "secondary",
  EM_EXECUCAO: "secondary",
  CONCLUIDO: "default",
  NEGADO: "destructive",
};

const PRIORIDADE_VARIANT: Record<
  "NORMAL" | "ALTA" | "URGENTE",
  "default" | "secondary" | "destructive" | "outline"
> = {
  NORMAL: "outline",
  ALTA: "secondary",
  URGENTE: "destructive",
};

const STATUS_SOLICITACAO_ABERTA = new Set<StatusFluxo>([
  "RASCUNHO",
  "PENDENTE_APROVACAO",
  "APROVADO",
  "EM_TRANSPORTE",
  "EM_EXECUCAO",
]);

const calcularDataFim = (
  inicio: string,
  dias: number | null,
): string | null => {
  if (!inicio || dias == null) return null;
  const base = new Date(`${inicio}T00:00:00`);
  if (isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);
};

interface EquipamentoPlanejadoAgrupado {
  chave: string;
  descricao: string;
  familia: string;
  quantidade: number;
  inicio: string | null;
  fim: string | null;
  atividades: number;
}

function normalizarChave(s: string | null | undefined): string {
  return (s ?? "").toString().trim().toUpperCase();
}

const EquipamentosTab: React.FC<Props> = ({
  centroCustoId,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  planejamentoId = null,
  planVigenteInicio = null,
  planVigenteFim = null,
}) => {
  const navigate = useNavigate();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const recursosQ = useRecursosPorPlanejamento(planejamentoId);
  const dispQ = useEquipamentosDisponiveisNoCC({
    centroCustoId,
    semanaInicio: planVigenteInicio ?? dataInicio ?? null,
    semanaFim: planVigenteFim ?? dataFim ?? null,
  });

  const { data: solData, isLoading, isError, refetch, isFetching } =
    useSolicitacoesEquipamentoPlanejamento({
      centroCustoId,
      dataInicio,
      dataFim,
    });

  // ----- Seção A: Equipamentos Planejados (agrupados por descrição) -----
  const equipamentosPlanejados = useMemo<EquipamentoPlanejadoAgrupado[]>(() => {
    const recursos = (recursosQ.data ?? []) as any[];
    const map = new Map<string, EquipamentoPlanejadoAgrupado>();
    for (const r of recursos) {
      if (!isEquipamentoOperacional(r)) continue;
      const chave = normalizarChave(r.descricao);
      if (!chave) continue;
      let row = map.get(chave);
      if (!row) {
        row = {
          chave,
          descricao: r.descricao ?? "—",
          familia: (r.familia ?? "EQ").toString(),
          quantidade: 0,
          inicio: null,
          fim: null,
          atividades: 0,
        };
        map.set(chave, row);
      }
      row.quantidade += Number(r.quantidade_prevista) || 0;
      row.atividades += 1;
      const ini = r.data_necessaria_inicio ?? null;
      const fim = r.data_necessaria_fim ?? null;
      if (ini && (!row.inicio || ini < row.inicio)) row.inicio = ini;
      if (fim && (!row.fim || fim > row.fim)) row.fim = fim;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.descricao.localeCompare(b.descricao, "pt-BR")
    );
  }, [recursosQ.data]);

  const totalUnidadesPlanejadas = useMemo(
    () => equipamentosPlanejados.reduce((s, e) => s + e.quantidade, 0),
    [equipamentosPlanejados]
  );

  // Disponibilidade real por descrição (de bd_disponibilidade_equipamentos via hook).
  // Solicitações por descrição (de solQ.data) — separadas da disponibilidade.
  const solicitacoesPorChave = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of (solData ?? []) as SolicitacaoEquipamentoPlanejamentoItem[]) {
      if (!STATUS_SOLICITACAO_ABERTA.has(s.status_fluxo)) continue;
      const chave = normalizarChave(s.descricao_tipo_equipamento);
      if (!chave) continue;
      map.set(chave, (map.get(chave) ?? 0) + (s.quantidade ?? 1));
    }
    return map;
  }, [solData]);

  const irParaSolicitacao = (descricao?: string) => {
    const params = new URLSearchParams();
    if (centroCustoId) params.set("centro_custo_id", centroCustoId);
    params.set("origem", "planejamento_macro");
    if (descricao) params.set("descricao", descricao);
    navigate(`/gestao-maquinas/solicitacoes-equipamentos?${params.toString()}`);
  };

  // ----- Seção B: Solicitações (paginadas) -----
  const lista = solData ?? [];
  const pag = usePagination<SolicitacaoEquipamentoPlanejamentoItem>(lista, {
    pageSize: DEFAULT_PAGE_SIZE,
  });

  return (
    <div className="space-y-4">
      {/* ============ Seção A — Equipamentos Planejados ============ */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <TabHeader
            title="Equipamentos Planejados"
            description="Equipamentos importados do cronograma para este planejamento, agrupados por descrição."
          />

          {!planejamentoId ? (
            <div className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/30">
              Selecione um planejamento vigente para ver os equipamentos planejados.
            </div>
          ) : recursosQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : equipamentosPlanejados.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/30">
              Nenhum equipamento operacional (família EQ) encontrado no planejamento importado.
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Linhas agrupadas por equipamento. Total de unidades planejadas:{" "}
                <strong>{totalUnidadesPlanejadas}</strong> — deve coincidir com o
                card "Equipamentos previstos".
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Família</TableHead>
                      <TableHead className="text-right">Qtd. planejada</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Atividades</TableHead>
                      <TableHead className="text-right">Disponibilidade no CC</TableHead>
                      <TableHead className="text-right">Solicitações abertas</TableHead>
                      <TableHead className="text-right">Gap</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipamentosPlanejados.map((eq) => {
                      const dispRow = dispQ.data?.get(eq.chave);
                      // Disponibilidade real só vem do hook de disponibilidade,
                      // nunca de solQ.data. Se não houver dado confiável, mostra "—".
                      const dispTemDado = !!dispRow && !dispQ.isLoading;
                      const disponivel = dispTemDado ? dispRow!.disponivel : null;
                      const solAbertas = solicitacoesPorChave.get(eq.chave) ?? 0;
                      const gap =
                        disponivel != null
                          ? Math.max(0, eq.quantidade - disponivel - solAbertas)
                          : null;
                      return (
                        <TableRow key={eq.chave}>
                          <TableCell className="font-medium">{eq.descricao}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{eq.familia}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {eq.quantidade}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {eq.inicio || eq.fim
                              ? formatarPeriodoBR(eq.inicio, eq.fim)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                            {eq.atividades}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {disponivel != null ? (
                              disponivel
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground cursor-help">—</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Disponibilidade real será vinculada ao catálogo/localização de equipamentos em fase futura.
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {solAbertas}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {gap != null ? (
                              <Badge variant={gap > 0 ? "destructive" : "outline"}>
                                {gap}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => irParaSolicitacao(eq.descricao)}
                                >
                                  <Wrench className="h-4 w-4" />
                                  <span className="text-xs">Solicitar</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Abre o módulo de Solicitação de Equipamentos pré-filtrado pelo Centro de Custo. A descrição será sugerida em fase futura quando o formulário consumir o parâmetro.
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============ Seção B — Solicitações reais do período (complementar) ============ */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <TabHeader
            title="Solicitações de Equipamento do Período"
            description="Solicitações reais já abertas para este Centro de Custo no período selecionado."
            actions={
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => irParaSolicitacao()} size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Abrir Solicitação de Equipamentos
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Abre o módulo de Solicitação de Equipamentos pré-filtrado pelo Centro de Custo selecionado.
                </TooltipContent>
              </Tooltip>
            }
          />

          <Collapsible open={filtrosAbertos} onOpenChange={setFiltrosAbertos}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros avançados
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${filtrosAbertos ? "rotate-180" : ""}`}
                />
                <span className="text-xs text-muted-foreground ml-1">
                  {dataInicio} → {dataFim}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-3 rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Período usado para listar solicitações reais e cruzar com a disponibilidade no Centro de Custo.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="eq-data-inicio">Data início</Label>
                    <Input
                      id="eq-data-inicio"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => onDataInicioChange(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="eq-data-fim">Data fim</Label>
                    <Input
                      id="eq-data-fim"
                      type="date"
                      value={dataFim}
                      onChange={(e) => onDataFimChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>Não foi possível carregar as solicitações deste período.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          ) : !solData || solData.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/30">
              Nenhuma solicitação real encontrada para este Centro de Custo no período.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Solicitante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pag.paginatedData.map((s: SolicitacaoEquipamentoPlanejamentoItem) => {
                      const fim = calcularDataFim(s.data_inicio, s.tempo_previsto_dias);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.id_curto}</TableCell>
                          <TableCell className="font-medium">
                            {s.descricao_tipo_equipamento ?? "Equipamento não identificado"}
                          </TableCell>
                          <TableCell>{s.quantidade}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatarPeriodoBR(s.data_inicio, fim)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={PRIORIDADE_VARIANT[s.prioridade]}>
                              {s.prioridade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_FLUXO_VARIANT[s.status_fluxo]}>
                              {s.status_fluxo_label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {lista.length > 0 && (
                <PaginationFooter
                  totalItems={pag.totalItems}
                  startIndex={pag.startIndex}
                  endIndex={pag.endIndex}
                  currentPage={pag.currentPage}
                  totalPages={pag.totalPages}
                  canPreviousPage={pag.canPreviousPage}
                  canNextPage={pag.canNextPage}
                  onPrevious={pag.previousPage}
                  onNext={pag.nextPage}
                  itemLabel="solicitações"
                  pageSize={pag.pageSize}
                  onPageSizeChange={pag.setPageSize}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EquipamentosTab;
