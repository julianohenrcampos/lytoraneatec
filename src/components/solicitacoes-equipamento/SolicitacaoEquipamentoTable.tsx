import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { Eye, Pencil, Trash2 } from "lucide-react";
import { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";
import { formatItemDisplay } from "@/utils/solicitacaoItemDisplay";
import { formatDateBR } from "@/utils/formatDateBR";
import { formatProtocolo } from "@/utils/formatProtocolo";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import {
  getStatusBadgeConfig,
  podeEditarSolicitacao,
  podeExcluirSolicitacao,
} from "@/utils/solicitacaoStatus";

interface Props {
  solicitacoes: SolicitacaoEquipamento[];
  isLoading: boolean;
  isError: boolean;
  onView?: (s: SolicitacaoEquipamento) => void;
  onEdit?: (s: SolicitacaoEquipamento) => void;
  onDelete?: (id: string) => Promise<boolean | void> | boolean | void;
  userId?: string | null;
  isSuperAdmin?: boolean;
  permissions?: string[] | null;
}

const prioridadeColors: Record<string, string> = {
  NORMAL: "bg-muted text-muted-foreground",
  ALTA: "bg-orange-100 text-orange-800",
  URGENTE: "bg-red-100 text-red-800",
};

const extractCcCodigo = (raw?: string | null): string => {
  if (!raw) return "-";
  const s = String(raw).trim();
  const m = s.split(/\s+[-—]\s+/);
  return (m[0] || s).trim() || "-";
};

const SolicitacaoEquipamentoTable: React.FC<Props> = ({
  solicitacoes,
  isLoading,
  isError,
  onView,
  onEdit,
  onDelete,
  userId,
  isSuperAdmin,
  permissions,
}) => {
  const pagination = usePagination(solicitacoes, { pageSize: 10 });

  const [deleteTarget, setDeleteTarget] = useState<SolicitacaoEquipamento | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const closeDelete = () => setDeleteTarget(null);

  if (isError)
    return (
      <div className="rounded-md border border-destructive p-8 text-center">
        <p className="text-destructive">Erro ao carregar solicitações.</p>
      </div>
    );
  if (isLoading)
    return (
      <div className="rounded-md border p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  if (solicitacoes.length === 0)
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Nenhuma solicitação encontrada.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Tipo Equipamento</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead className="text-center">Qtd</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status Fluxo</TableHead>
              <TableHead>Data da Solicitação</TableHead>
              <TableHead>Data Início</TableHead>
              <TableHead className="w-[132px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((s) => {
              const statusCfg = getStatusBadgeConfig(s.status_fluxo);
              const canEdit = !!onEdit && podeEditarSolicitacao(s, userId, isSuperAdmin, permissions);
              const canDelete =
                !!onDelete && podeExcluirSolicitacao(s, userId, isSuperAdmin, permissions);

              const ccRaw = s.codigo_centro_custo
                ? String(s.codigo_centro_custo)
                : s.nome_centro_custo
                  ? extractCcCodigo(s.nome_centro_custo)
                  : "-";

              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{formatProtocolo(s.id)}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>
                        {s.itens && s.itens.length > 0
                          ? formatItemDisplay(s.itens[0])
                          : s.descricao_tipo_equipamento || s.itens_resumo || "-"}
                      </span>
                      {s.itens && s.itens.length > 1 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{s.itens.length - 1}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{ccRaw}</TableCell>
                  <TableCell className="text-center">{s.quantidade}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prioridadeColors[s.prioridade] || ""}>
                      {s.prioridade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusCfg.className}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateBR(s.created_at)}</TableCell>
                  <TableCell>{formatDateBR(s.data_inicio)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onView?.(s)}
                        disabled={!onView}
                        title="Ver"
                        aria-label="Ver solicitação"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEdit?.(s)}
                        disabled={!canEdit}
                        title="Editar"
                        aria-label="Editar solicitação"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteTarget(s)}
                        disabled={!canDelete}
                        title="Excluir"
                        aria-label="Excluir solicitação"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {solicitacoes.length > 10 && <TablePagination pagination={pagination} />}

      {/* Excluir */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !isDeleting && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta solicitação? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Não</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget || isDeleting) return;
                const id = deleteTarget.id;
                setIsDeleting(true);
                try {
                  const ok = await onDelete?.(id);
                  if (ok !== false) closeDelete();
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SolicitacaoEquipamentoTable;
