import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Truck, Users, Package, Eye, Edit, AlertCircle, ClipboardList, PlayCircle, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { formatMassaDisplay } from "@/utils/massaConversionUtils";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { usePermission } from "@/hooks/usePermission";
import { useAuth } from "@/hooks/useAuth";
import { useExcluirRegistroManual } from "@/hooks/registro-aplicacao/useExcluirRegistroManual";
import { parseContextoOperacional } from "@/utils/registroAplicacao/parseContextoOperacional";
import VisualizarRegistroManualModal from "./VisualizarRegistroManualModal";
import type { RegistroManualRow } from "@/hooks/registro-aplicacao/useRegistrosManuais";
import type { RegistroManualDraft } from "@/hooks/registro-aplicacao/useRegistroManualDrafts";


export interface CentroCustoLookup {
  id: string;
  codigo_centro_custo?: string;
  nome_centro_custo?: string;
}

interface BaseRow {
  id: string;
  data: string | null;
  centroCustoLabel: string;
  logradouro: string;
  caminhao: string;
  equipe: string;
  massa: React.ReactNode;
}

type UnifiedRow =
  | (BaseRow & { origem: "logistico"; status: string; raw: ListaProgramacaoEntrega })
  | (BaseRow & { origem: "manual"; status: "Manual"; raw: RegistroManualRow })
  | (BaseRow & { origem: "rascunho"; status: "Rascunho"; raw: RegistroManualDraft });

interface Props {
  entregas: ListaProgramacaoEntrega[];
  isLoading: boolean;
  onEntregaSelect: (entrega: ListaProgramacaoEntrega) => void;
  registrosManuais?: RegistroManualRow[];
  rascunhos?: RegistroManualDraft[];
  onContinuarRascunho?: (draftId: string) => void;
  onDescartarRascunho?: (draftId: string) => void;
  statusFilter?: string;
  centroCustoById?: Record<string, CentroCustoLookup>;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "Enviada":
      return "default" as const;
    case "Entregue":
      return "secondary" as const;
    case "Pendente":
      return "outline" as const;
    case "Manual":
      return "secondary" as const;
    case "Rascunho":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

const FALLBACK_CC_LABEL = "Centro de custo não identificado";

const formatCcLabel = (codigo?: string | null, nome?: string | null): string => {
  const c = (codigo || "").trim();
  const n = (nome || "").trim();
  if (c && n) return `${c} — ${n}`;
  if (c) return c;
  if (n) return n;
  return "";
};

const EntregasEnviadasTable: React.FC<Props> = ({
  entregas,
  isLoading,
  onEntregaSelect,
  registrosManuais = [],
  rascunhos = [],
  onContinuarRascunho,
  onDescartarRascunho,
  statusFilter,
  centroCustoById = {},
}) => {
  const [descartarId, setDescartarId] = useState<string | null>(null);
  const [visualizarId, setVisualizarId] = useState<string | null>(null);
  const [excluirManualId, setExcluirManualId] = useState<string | null>(null);
  const { isSuperAdmin, isLoading: isPermissionLoading } = usePermission();
  const { userId } = useAuth();
  const excluirManualMutation = useExcluirRegistroManual({
    onSuccess: () => setExcluirManualId(null),
  });


  const resolveCcById = (id?: string | null): string => {
    if (!id) return "";
    const cc = centroCustoById[id];
    if (!cc) return "";
    return formatCcLabel(cc.codigo_centro_custo, cc.nome_centro_custo);
  };

  const unified: UnifiedRow[] = useMemo(() => {
    const logRows: UnifiedRow[] = (entregas || []).map((e) => {
      const codigo =
        e.centro_custo?.codigo_centro_custo ||
        e.requisicao?.centro_custo?.codigo_centro_custo ||
        "";
      const nome =
        e.centro_custo_nome ||
        e.centro_custo?.nome_centro_custo ||
        e.requisicao?.centro_custo?.nome_centro_custo ||
        "";
      const label = formatCcLabel(codigo, nome) || nome || FALLBACK_CC_LABEL;
      return {
        origem: "logistico",
        id: `log-${e.id}`,
        data: e.data_entrega,
        centroCustoLabel: label,
        logradouro: e.logradouro,
        caminhao: e.caminhao?.placa || "N/A",
        equipe: e.equipe?.nome_equipe || "N/A",
        massa: <Badge variant="outline">{formatMassaDisplay(e.quantidade_massa)}</Badge>,
        status: e.status,
        raw: e,
      };
    });
    const manRows: UnifiedRow[] = (registrosManuais || []).map((m) => {
      const ctx = parseContextoOperacional(m.observacoes_gerais);
      const caminhaoLabel = ctx.placa || ctx.caminhaoFrota || "Manual";
      const equipeLabel = ctx.equipe || "Manual";
      return {
        origem: "manual",
        id: `man-${m.id}`,
        data: m.data_aplicacao,
        centroCustoLabel: resolveCcById(m.centro_custo_id) || FALLBACK_CC_LABEL,
        logradouro: m.logradouro_aplicado || "-",
        caminhao: caminhaoLabel,
        equipe: equipeLabel,
        massa: (
          <Badge variant="outline">
            {Number(m.tonelada_aplicada || 0).toFixed(2)} t
          </Badge>
        ),
        status: "Manual",
        raw: m,
      };
    });
    const rascRows: UnifiedRow[] = (rascunhos || []).map((d) => {
      const draftLabel = formatCcLabel(d.centroCustoCodigo, d.centroCustoNome);
      const label =
        draftLabel || resolveCcById(d.centroCustoId) || FALLBACK_CC_LABEL;
      return {
        origem: "rascunho",
        id: `rasc-${d.id}`,
        data: d.data || d.updatedAt?.slice(0, 10) || null,
        centroCustoLabel: label,
        logradouro: d.logradouro || "(sem logradouro)",
        caminhao: "Rascunho",
        equipe: "Rascunho",
        massa: <Badge variant="outline">— </Badge>,
        status: "Rascunho",
        raw: d,
      };
    });
    const all = [...rascRows, ...manRows, ...logRows];
    const filtered = statusFilter
      ? all.filter((r) => r.status === statusFilter)
      : all;
    return filtered.sort((a, b) => {
      const da = a.data || "";
      const db = b.data || "";
      return db.localeCompare(da);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entregas, registrosManuais, rascunhos, statusFilter, centroCustoById]);


  const pagination = usePagination(unified, { pageSize: 10 });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando registros...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalCount = unified.length;

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Registros de Aplicação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fluxo logístico, registros manuais e rascunhos locais.
          </p>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <Package className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-muted-foreground">Nenhum registro encontrado</p>
              <p className="text-sm text-muted-foreground">Ajuste os filtros ou crie um novo registro manual.</p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Dica:</strong> Verifique data e centro de custo nos filtros acima.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderAction = (row: UnifiedRow) => {
    if (row.origem === "rascunho") {
      return (
        <div className="flex gap-1">
          <Button
            variant="default"
            size="sm"
            onClick={() => onContinuarRascunho?.(row.raw.id)}
            className="flex items-center gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            Continuar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDescartarId(row.raw.id)}
            aria-label="Descartar rascunho"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    if (row.origem === "manual") {
      return (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setVisualizarId(row.raw.id);
            }}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Visualizar
          </Button>
          {!isPermissionLoading && isSuperAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="flex items-center gap-2 opacity-70"
                      aria-label="Editar registro manual (indisponível)"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Edição de registro manual ainda não disponível. Para corrigir,
                  exclua e recrie o registro. Edição segura será liberada em
                  fase posterior.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(() => {
            const podeExcluir =
              !isPermissionLoading &&
              (isSuperAdmin || (!!userId && row.raw.created_by === userId));
            if (!podeExcluir) return null;
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExcluirManualId(row.raw.id);
                      }}
                      aria-label="Excluir registro manual"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir registro manual</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })()}
        </div>
      );
    }

    const isEditable = row.raw.status === "Enviada" || row.raw.status === "Pendente";
    return (
      <Button
        variant={isEditable ? "default" : "outline"}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onEntregaSelect(row.raw);
        }}
        className="flex items-center gap-2"
      >
        {isEditable ? (
          <>
            <Edit className="h-4 w-4" />
            Registrar
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" />
            Visualizar
          </>
        )}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Registros de Aplicação ({totalCount})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Fluxo logístico, registros manuais e rascunhos locais.
          </p>
        </CardHeader>
        <CardContent>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {pagination.paginatedData.map((row) => {
              const clickable = row.origem === "logistico" || row.origem === "manual";
              const handleCardClick = () => {
                if (row.origem === "logistico") onEntregaSelect(row.raw);
                else if (row.origem === "manual") setVisualizarId(row.raw.id);
              };
              return (
                <div
                  key={row.id}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? handleCardClick : undefined}
                  className={`rounded-lg border bg-card p-3 shadow-sm transition ${
                    clickable ? "hover:border-primary/40 active:scale-[0.99] cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate" title={row.centroCustoLabel}>
                        {row.centroCustoLabel}
                      </div>
                      {row.logradouro && row.logradouro !== "-" && (
                        <div
                          className="text-xs text-muted-foreground truncate"
                          title={row.logradouro}
                        >
                          {row.logradouro}
                        </div>
                      )}
                    </div>
                    <Badge variant={getStatusBadgeVariant(row.status)} className="shrink-0">
                      {row.status}
                    </Badge>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {row.data ? formatBrazilianDateForDisplay(row.data) : "-"}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-xs truncate">{row.caminhao}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-xs truncate">{row.equipe}</span>
                    </div>
                  </div>

                  <div className="mt-1 text-xs">
                    <span className="text-muted-foreground">Massa: </span>
                    <span className="font-medium">{row.massa}</span>
                  </div>

                  <div
                    className="mt-3 pt-2 border-t flex flex-wrap justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderAction(row)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Caminhão</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Massa Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedData.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.origem === "logistico"
                        ? "hover:bg-muted/50 cursor-pointer"
                        : "hover:bg-muted/30"
                    }
                    onClick={() => {
                      if (row.origem === "logistico") onEntregaSelect(row.raw);
                    }}
                  >
                    <TableCell>
                      {row.data ? formatBrazilianDateForDisplay(row.data) : "-"}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="font-medium truncate" title={row.centroCustoLabel}>
                        {row.centroCustoLabel}
                      </div>
                      {row.logradouro && row.logradouro !== "-" && (
                        <div
                          className="text-xs text-muted-foreground truncate"
                          title={row.logradouro}
                        >
                          {row.logradouro}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        <span className="font-mono text-sm">{row.caminhao}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{row.equipe}</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.massa}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{renderAction(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalCount > 0 && <TablePagination pagination={pagination} />}

      <AlertDialog
        open={descartarId !== null}
        onOpenChange={(v) => !v && setDescartarId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar rascunho local?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o rascunho salvo neste dispositivo e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (descartarId) onDescartarRascunho?.(descartarId);
                setDescartarId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VisualizarRegistroManualModal
        registroId={visualizarId}
        open={visualizarId !== null}
        onOpenChange={(v) => !v && setVisualizarId(null)}
        centroCustoById={centroCustoById}
      />

      <AlertDialog
        open={excluirManualId !== null}
        onOpenChange={(v) => !v && !excluirManualMutation.isPending && setExcluirManualId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir registro manual?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o registro e todos os apontamentos vinculados. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirManualMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluirManualMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (excluirManualId) excluirManualMutation.mutate(excluirManualId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirManualMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
};

export default EntregasEnviadasTable;
