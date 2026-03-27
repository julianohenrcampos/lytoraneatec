import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Building2, AlertTriangle } from "lucide-react";
import { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface Props {
  solicitacoes: SolicitacaoEquipamento[];
  isLoading: boolean;
  isError: boolean;
}

const statusColors: Record<string, string> = {
  ABERTO: "bg-blue-100 text-blue-800",
  EM_ANALISE: "bg-yellow-100 text-yellow-800",
  ATENDIDO: "bg-green-100 text-green-800",
  NEGADO: "bg-red-100 text-red-800",
};

const prioridadeColors: Record<string, string> = {
  NORMAL: "bg-muted text-muted-foreground",
  ALTA: "bg-orange-100 text-orange-800",
  URGENTE: "bg-red-100 text-red-800",
};

const matchingConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  PROPRIO: { icon: <Truck className="h-3.5 w-3.5" />, className: "bg-green-100 text-green-800 border-green-300", label: "Próprio" },
  GRUPO: { icon: <Building2 className="h-3.5 w-3.5" />, className: "bg-blue-100 text-blue-800 border-blue-300", label: "Grupo" },
  FORNECEDOR: { icon: <Building2 className="h-3.5 w-3.5" />, className: "bg-orange-100 text-orange-800 border-orange-300", label: "Fornecedor" },
  NAO_ENCONTRADO: { icon: <AlertTriangle className="h-3.5 w-3.5" />, className: "bg-red-100 text-red-800 border-red-300", label: "Não Encontrado" },
};

const SolicitacaoEquipamentoTable: React.FC<Props> = ({ solicitacoes, isLoading, isError }) => {
  const pagination = usePagination(solicitacoes, { pageSize: 10 });

  if (isError) return <div className="rounded-md border border-destructive p-8 text-center"><p className="text-destructive">Erro ao carregar solicitações.</p></div>;
  if (isLoading) return <div className="rounded-md border p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (solicitacoes.length === 0) return <div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Nenhuma solicitação encontrada.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo Equipamento</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead className="text-center">Qtd</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem Matching</TableHead>
              <TableHead className="text-center">Disponível</TableHead>
              <TableHead>Sugestão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((s) => {
              const matching = s.resultado_matching ? matchingConfig[s.resultado_matching] : null;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.descricao_tipo_equipamento || "-"}</TableCell>
                  <TableCell>{s.codigo_centro_custo ? `${s.codigo_centro_custo} - ${s.nome_centro_custo}` : s.nome_centro_custo || "-"}</TableCell>
                  <TableCell className="text-center">{s.quantidade}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prioridadeColors[s.prioridade] || ""}>{s.prioridade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[s.status] || ""}>{s.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    {matching ? (
                      <Badge variant="outline" className={`${matching.className} inline-flex items-center gap-1`}>
                        {matching.icon}
                        {matching.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.quantidade_disponivel_encontrada != null ? (
                      <span className="font-semibold">{s.quantidade_disponivel_encontrada}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {s.sugestao_acao || "—"}
                  </TableCell>
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
