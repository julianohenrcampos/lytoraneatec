import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AtivoReconciliado } from "@/services/disponibilidadeEquipamentoService";
import {
  STATUS_OPERACIONAL_LABELS,
  rotuloCentroCusto,
  type StatusOperacionalCanonico,
} from "@/lib/ativos/reconciliacaoOperacional";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { ACAO_LISTAGEM } from "./disponibilidadeFormLogic";

interface Props {
  data: AtivoReconciliado[];
  isLoading: boolean;
  isError: boolean;
  /** false enquanto as permissões carregam ou sem action `editar`. */
  podeEditar: boolean;
  onEdit: (item: AtivoReconciliado) => void;
}

const statusClass: Record<StatusOperacionalCanonico, string> = {
  DISPONIVEL: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ALOCADO: "bg-blue-100 text-blue-800 border-blue-300",
  MANUTENCAO: "bg-amber-100 text-amber-800 border-amber-300",
  INDISPONIVEL: "bg-red-100 text-red-800 border-red-300",
  // SEM_STATUS é estado legítimo e visível — nunca oculto.
  SEM_STATUS: "bg-muted text-muted-foreground border-dashed",
  DESCONHECIDO: "bg-muted text-muted-foreground",
};

const confiabilidadeConfig: Record<string, string> = {
  ALTA: "bg-emerald-100 text-emerald-800",
  MEDIA: "bg-amber-100 text-amber-800",
  BAIXA: "bg-red-100 text-red-800",
};

const DisponibilidadeTable: React.FC<Props> = ({ data, isLoading, isError, podeEditar, onEdit }) => {
  const pagination = usePagination(data, { pageSize: 10 });

  if (isError)
    return (
      <div className="rounded-md border border-destructive p-8 text-center">
        <p className="text-destructive">Erro ao carregar dados.</p>
      </div>
    );
  if (isLoading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  if (data.length === 0)
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Nenhum ativo corresponde aos filtros aplicados.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Situação cadastral</TableHead>
              <TableHead>Status operacional</TableHead>
              <TableHead>Previsão Liberação</TableHead>
              <TableHead>Confiabilidade</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((a) => (
              <TableRow key={a.equipamentoId}>
                <TableCell className="font-medium">
                  {a.frota || "-"}
                  {a.numeroFrota ? `-${a.numeroFrota}` : ""}
                </TableCell>
                <TableCell>{a.placa || "-"}</TableCell>
                <TableCell>{a.tipoEquipamentoDescricao || "-"}</TableCell>
                <TableCell>{a.empresaNome || "-"}</TableCell>
                <TableCell>
                  {a.possuiCentroCustoAtual && !a.referenciaCentroCustoNaoResolvida ? (
                    rotuloCentroCusto(a)
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {rotuloCentroCusto(a)}
                    </span>
                  )}
                </TableCell>
                <TableCell>{a.departamentoNome || "-"}</TableCell>
                <TableCell>
                  <span className="text-xs">{a.situacaoCadastral || "-"}</span>
                  {a.possuiConflitoCadastral && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-600" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {a.conflitoCadastralMotivo}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusClass[a.statusOperacional]}>
                    {STATUS_OPERACIONAL_LABELS[a.statusOperacional]}
                  </Badge>
                </TableCell>
                <TableCell>{a.previsaoLiberacao || "-"}</TableCell>
                <TableCell>
                  {a.confiabilidadePrevisao ? (
                    <Badge variant="outline" className={confiabilidadeConfig[a.confiabilidadePrevisao] || ""}>
                      {a.confiabilidadePrevisao}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {podeEditar && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(a)}
                          aria-label={
                            a.possuiRegistroDisponibilidade
                              ? ACAO_LISTAGEM.EDIT
                              : ACAO_LISTAGEM.CREATE
                          }
                          title={
                            a.possuiRegistroDisponibilidade
                              ? ACAO_LISTAGEM.EDIT
                              : ACAO_LISTAGEM.CREATE
                          }
                        >
                          {a.possuiRegistroDisponibilidade ? (
                            <Pencil className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {a.possuiRegistroDisponibilidade ? ACAO_LISTAGEM.EDIT : ACAO_LISTAGEM.CREATE}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default DisponibilidadeTable;
