import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Building2, AlertTriangle } from "lucide-react";
import { SolicitacaoEquipamento, StatusFluxo } from "@/services/solicitacaoEquipamentoService";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface Props {
  solicitacoes: SolicitacaoEquipamento[];
  isLoading: boolean;
  isError: boolean;
  onSelectForApproval?: (s: SolicitacaoEquipamento) => void;
}

const statusFluxoColors: Record<string, string> = {
  RASCUNHO: "bg-muted text-muted-foreground",
  PENDENTE_APROVACAO: "bg-yellow-100 text-yellow-800",
  APROVADO: "bg-green-100 text-green-800",
  EM_TRANSPORTE: "bg-blue-100 text-blue-800",
  EM_EXECUCAO: "bg-purple-100 text-purple-800",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
  NEGADO: "bg-red-100 text-red-800",
};

const statusFluxoLabels: Record<string, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_APROVACAO: "Pendente Aprovação",
  APROVADO: "Aprovado",
  EM_TRANSPORTE: "Em Transporte",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDO: "Concluído",
  NEGADO: "Negado",
};

const prioridadeColors: Record<string, string> = {
  NORMAL: "bg-muted text-muted-foreground",
  ALTA: "bg-orange-100 text-orange-800",
  URGENTE: "bg-red-100 text-red-800",
};

const SolicitacaoEquipamentoTable: React.FC<Props> = ({ solicitacoes, isLoading, isError, onSelectForApproval }) => {
  const pagination = usePagination(solicitacoes, { pageSize: 10 });

  if (isError) return <div className="rounded-md border border-destructive p-8 text-center"><p className="text-destructive">Erro ao carregar solicitações.</p></div>;
  if (isLoading) return <div className="rounded-md border p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (solicitacoes.length === 0) return <div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Nenhuma solicitação encontrada.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo Equipamento</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Engenheiro</TableHead>
              <TableHead>Apontador</TableHead>
              <TableHead className="text-center">Qtd</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status Fluxo</TableHead>
              <TableHead>Data Início</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((s) => {
              const canApprove = s.status_fluxo === "PENDENTE_APROVACAO" && onSelectForApproval;
              return (
                <TableRow
                  key={s.id}
                  className={canApprove ? "cursor-pointer hover:bg-accent/50" : ""}
                  onClick={() => canApprove && onSelectForApproval?.(s)}
                >
                  <TableCell className="font-medium">{s.descricao_tipo_equipamento || "-"}</TableCell>
                  <TableCell>{s.codigo_centro_custo ? `${s.codigo_centro_custo} - ${s.nome_centro_custo}` : s.nome_centro_custo || "-"}</TableCell>
                  <TableCell>{s.engenheiro_nome || "-"}</TableCell>
                  <TableCell>{s.apontador_nome || "-"}</TableCell>
                  <TableCell className="text-center">{s.quantidade}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prioridadeColors[s.prioridade] || ""}>{s.prioridade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusFluxoColors[s.status_fluxo] || ""}>
                      {statusFluxoLabels[s.status_fluxo] || s.status_fluxo}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.data_inicio}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {solicitacoes.length > 10 && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default SolicitacaoEquipamentoTable;
