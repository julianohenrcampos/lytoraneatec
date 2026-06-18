import React, { useEffect, useMemo, useState } from "react";
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
import { formatarDataBR } from "../shared/formatData";
import { ClipboardList, Pencil, Search, Users2 } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { useContagemRecursosPorPlanejamento } from "@/hooks/planejamentoMacro/useContagemRecursosPorPlanejamento";

interface Props {
  atividades: AtividadePlanejada[];
  isSuperAdmin?: boolean;
  planejamentoStatus?: "rascunho" | "vigente" | "arquivado" | null;
  planejamentoId?: string | null;
  onEditarAtividade?: (id: string) => void;
  onPlanejarRecursos?: (id: string) => void;
}

const DEFAULT_PAGE_SIZE = 10;

type StatusFiltro =
  | "todas"
  | "planejada"
  | "em_andamento"
  | "concluida"
  | "atrasada"
  | "cancelada";

// Fallback: deriva o status técnico a partir do label (caso status_tecnico não venha preenchido).
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
  isSuperAdmin = false,
  planejamentoStatus = null,
  planejamentoId = null,
  onEditarAtividade,
  onPlanejarRecursos,
}) => {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todas");

  const contagem = useContagemRecursosPorPlanejamento(planejamentoId);
  const contagemMap = contagem.data ?? {};

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

  // Reset para página 1 ao mudar busca/filtro (preserva pageSize).
  useEffect(() => {
    pag.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, statusFiltro]);

  const canEdit =
    isSuperAdmin &&
    planejamentoStatus !== "arquivado" &&
    !!onEditarAtividade;

  const canPlanejarRecursos =
    isSuperAdmin &&
    planejamentoStatus !== "arquivado" &&
    !!onPlanejarRecursos;

  const mostrarAcoes = canEdit || canPlanejarRecursos;

  const total = atividades.length;
  const totalFiltrado = atividadesFiltradas.length;

  return (
    <Card>
      <CardContent className="pt-6">
        <TabHeader
          title="Atividades do Cronograma"
          description="Lista completa das atividades importadas do MS Project, com EAP, frente de serviço, datas e status."
        />

        {total === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" />}
            title="Nenhuma atividade planejada importada"
            description="As atividades aparecerão aqui após a importação de um cronograma profissional."
          />
        ) : (
          <>
            {/* Barra de busca + filtro */}
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
                        <TableHead>Recursos</TableHead>
                        <TableHead>Frente</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-40">Progresso</TableHead>
                        {mostrarAcoes && (
                          <TableHead className="w-24 text-right">Ações</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pag.paginatedData.map((a) => {
                        const cont = contagemMap[a.id] ?? {
                          mao_obra: 0,
                          equipamento: 0,
                          material: 0,
                        };
                        return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.nome}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {a.codigo_wbs ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex gap-1 items-center">
                              <Badge
                                variant={cont.mao_obra > 0 ? "default" : "outline"}
                                className="text-[10px] gap-1"
                                title={
                                  cont.mao_obra === 0
                                    ? "Nenhuma mão de obra planejada para esta atividade."
                                    : cont.mao_obra === 1
                                    ? "1 função de mão de obra planejada para esta atividade."
                                    : `${cont.mao_obra} funções de mão de obra planejadas para esta atividade.`
                                }
                              >
                                <Users2 className="h-3 w-3" />
                                MO {cont.mao_obra}
                              </Badge>
                              <Badge
                                variant={cont.equipamento > 0 ? "default" : "outline"}
                                className="text-[10px]"
                                title={
                                  cont.equipamento === 0
                                    ? "Nenhum equipamento planejado para esta atividade."
                                    : `${cont.equipamento} equipamento(s) planejado(s) para esta atividade.`
                                }
                              >
                                EQ {cont.equipamento}
                              </Badge>
                              <Badge
                                variant={cont.material > 0 ? "default" : "outline"}
                                className="text-[10px]"
                                title={
                                  cont.material === 0
                                    ? "Nenhum material planejado para esta atividade."
                                    : `${cont.material} material(is) planejado(s) para esta atividade.`
                                }
                              >
                                MAT {cont.material}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{a.frente}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatarDataBR(a.inicio)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatarDataBR(a.fim)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                statusTecnicoDe(a) === "cancelada"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs text-muted-foreground"
                              title="Avanço físico ainda não apontado. Será preenchido quando houver fonte real (apontamento ou importação)."
                            >
                              Sem apontamento físico
                            </span>
                          </TableCell>
                          {mostrarAcoes && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Editar atividade planejada"
                                    title="Editar atividade planejada"
                                    onClick={() => onEditarAtividade?.(a.id)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canPlanejarRecursos && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Ver recursos da atividade"
                                    title="Ver recursos da atividade"
                                    onClick={() => onPlanejarRecursos?.(a.id)}
                                  >
                                    <Users2 className="h-4 w-4" />
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
    </Card>
  );
};

export default AtividadesTab;
