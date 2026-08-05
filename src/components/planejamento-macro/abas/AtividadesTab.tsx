import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { AtividadePlanejada } from "@/types/planejamentoMacro";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import PaginationFooter from "../shared/PaginationFooter";
import ProgressoAtividadeCell from "../shared/ProgressoAtividadeCell";
import AtualizarAndamentoModal from "../modals/AtualizarAndamentoModal";
import { formatarDataBR } from "../shared/formatData";
import { CalendarRange, ClipboardList, Gauge, Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { usePermission } from "@/hooks/usePermission";
import { cn } from "@/lib/utils";


interface Props {
  atividades: AtividadePlanejada[];
  isSuperAdmin?: boolean;
  planejamentoStatus?: "rascunho" | "vigente" | "arquivado" | null;
  planejamentoId?: string | null;
  onAbrirNaSemana?: (atividadeId: string, dataInicioIso: string | null) => void;
  /** Fase 1C-2A — quando definido, faz scroll/destaque sem apagar filtros. */
  atividadeAlvoId?: string | null;
  onAtividadeAlvoConsumida?: () => void;
}

const DEFAULT_PAGE_SIZE = 10;

type StatusFiltro =
  | "todas"
  | "planejada"
  | "em_andamento"
  | "concluida"
  | "atrasada"
  | "cancelada";

const LABEL_TO_TECNICO: Record<string, string> = {
  Planejada: "planejada",
  "Em andamento": "em_andamento",
  Concluída: "concluida",
  Atrasada: "atrasada",
  Cancelada: "cancelada",
  Cancelado: "cancelada",
};

function statusTecnicoDe(a: AtividadePlanejada): string {
  const raw = a.status_tecnico ?? LABEL_TO_TECNICO[a.status] ?? "planejada";
  return raw.toString().toLowerCase().trim();
}

function matchBusca(a: AtividadePlanejada, q: string): boolean {
  if (!q) return true;
  const campos = [a.nome, a.codigo_wbs, a.frente, a.descricao];
  return campos.some((c) => (c ?? "").toString().toLowerCase().includes(q));
}

const AtividadesTab: React.FC<Props> = ({
  atividades,
  planejamentoStatus,
  onAbrirNaSemana,
  atividadeAlvoId = null,
  onAtividadeAlvoConsumida,
}) => {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todas");
  const [editando, setEditando] = useState<AtividadePlanejada | null>(null);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const { hasActionPermission } = usePermission();
  const canProgressoManual =
    hasActionPermission("engenharia_planejamento_progresso_manual", "editar") &&
    planejamentoStatus !== "arquivado";

  const atividadesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return atividades.filter((a) => {
      if (statusFiltro !== "todas" && statusTecnicoDe(a) !== statusFiltro) {
        return false;
      }
      return matchBusca(a, q);
    });
  }, [atividades, busca, statusFiltro]);

  const pag = usePagination<AtividadePlanejada>(atividadesFiltradas, {
    pageSize: DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    pag.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, statusFiltro]);

  const canAbrirNaSemana = !!onAbrirNaSemana;
  const mostrarAcoes = canAbrirNaSemana || canProgressoManual;

  // Fase 1C-2A — Abrir no Cronograma: navega para a página da atividade alvo
  // sem apagar filtros do usuário. Se estiver oculta pelos filtros, avisa.
  useEffect(() => {
    if (!atividadeAlvoId) return;
    const indice = atividadesFiltradas.findIndex((a) => a.id === atividadeAlvoId);
    if (indice < 0) {
      const existe = atividades.some((a) => a.id === atividadeAlvoId);
      if (existe) {
        toast.info(
          "Atividade está oculta pelos filtros atuais. Ajuste a busca ou o filtro de status."
        );
      } else {
        toast.warning("Atividade não encontrada no cronograma vigente.");
      }
      onAtividadeAlvoConsumida?.();
      return;
    }
    const pagina = Math.floor(indice / pag.pageSize);
    if (pagina !== pag.currentPage) {
      pag.setPage(pagina);
    }
    setDestaqueId(atividadeAlvoId);
    const t = window.setTimeout(() => {
      const el = rowRefs.current.get(atividadeAlvoId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const tFade = window.setTimeout(() => setDestaqueId(null), 2500);
    onAtividadeAlvoConsumida?.();
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(tFade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividadeAlvoId]);


  const total = atividades.length;
  const totalFiltrado = atividadesFiltradas.length;

  return (
    <Card>
      <CardContent className="pt-6">
        <TabHeader
          title="Atividades do Cronograma"
          description="Lista completa das atividades importadas do MS Project, com EAP, datas e progresso da obra (manual ou importado)."
        />

        {total === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="Nenhuma atividade planejada importada"
            description="As atividades aparecerão aqui após a importação de um cronograma profissional."
          />
        ) : (
          <>
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por atividade, EAP ou frente..."
                  className="pl-8"
                />
              </div>
              <div className="w-full md:w-56">
                <Select
                  value={statusFiltro}
                  onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="planejada">Planejadas</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluida">Concluídas</SelectItem>
                    <SelectItem value="atrasada">Atrasadas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-2 text-xs text-muted-foreground">
              {totalFiltrado === total
                ? `${total} ${total === 1 ? "atividade" : "atividades"}`
                : `${totalFiltrado} de ${total} atividades`}
            </div>

            {totalFiltrado === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="Nenhuma atividade corresponde aos filtros"
                description="Ajuste a busca ou troque o filtro de status para visualizar outras atividades."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atividade</TableHead>
                        <TableHead title="EAP corresponde ao código WBS importado do MS Project.">EAP</TableHead>
                        <TableHead className="whitespace-nowrap">Início / Fim</TableHead>
                        <TableHead className="w-64">Progresso</TableHead>
                        {mostrarAcoes && (
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pag.paginatedData.map((a) => {
                        const tecnico = statusTecnicoDe(a);
                        const semInicio = !a.inicio;
                        const concluida = tecnico === "concluida";
                        return (
                          <TableRow
                            key={a.id}
                            ref={(el) => {
                              if (el) rowRefs.current.set(a.id, el);
                              else rowRefs.current.delete(a.id);
                            }}
                            className={cn(
                              concluida && "bg-green-500/5 hover:bg-green-500/10",
                              destaqueId === a.id &&
                                "ring-2 ring-primary ring-offset-1 bg-primary/5 transition-colors"
                            )}
                          >
                            <TableCell className="align-top">
                              <div className="font-medium">{a.nome}</div>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <Badge
                                  variant={tecnico === "cancelada" ? "destructive" : "outline"}
                                  className={cn(
                                    "text-[10px] py-0",
                                    concluida && "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400"
                                  )}
                                >
                                  {a.status}
                                </Badge>
                                {a.frente && a.frente !== "—" && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {a.frente}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground align-top font-mono text-xs">
                              {a.codigo_wbs ?? "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top">
                              <div className="text-sm">{formatarDataBR(a.inicio)}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatarDataBR(a.fim)}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <ProgressoAtividadeCell
                                status={a.status}
                                status_tecnico={a.status_tecnico}
                                percentual_manual={a.percentual_manual ?? null}
                                percentual_concluido_importado={a.percentual_concluido_importado ?? null}
                                observacao={a.percentual_manual_observacao ?? null}
                                atualizadoEm={a.percentual_manual_atualizado_em ?? null}
                              />
                            </TableCell>
                            {mostrarAcoes && (
                              <TableCell className="text-right align-top">
                                <div className="flex justify-end gap-1">
                                  {canProgressoManual && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Atualizar andamento"
                                      title="Atualizar andamento manual da atividade"
                                      onClick={() => setEditando(a)}
                                    >
                                      <Gauge className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canAbrirNaSemana && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Abrir no Planejamento Semanal"
                                      title={
                                        semInicio
                                          ? "Atividade sem data de início. Não é possível abrir no Planejamento Semanal."
                                          : "Abrir no Planejamento Semanal"
                                      }
                                      disabled={semInicio}
                                      onClick={() =>
                                        !semInicio && onAbrirNaSemana?.(a.id, a.inicio)
                                      }
                                    >
                                      <CalendarRange className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
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
                  itemLabel="atividades"
                  pageSize={pag.pageSize}
                  onPageSizeChange={pag.setPageSize}
                />
              </>
            )}
          </>
        )}
      </CardContent>
      <AtualizarAndamentoModal
        open={!!editando}
        onOpenChange={(open) => !open && setEditando(null)}
        atividade={editando}
      />
    </Card>
  );
};

export default AtividadesTab;
