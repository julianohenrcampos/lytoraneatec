import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { PortfolioEmpresa } from "@/services/portfolioEmpresaService";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface Props {
  data: PortfolioEmpresa[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (item: PortfolioEmpresa) => void;
}

const homologacaoConfig: Record<string, string> = {
  HOMOLOGADO: "bg-green-100 text-green-800",
  PENDENTE: "bg-yellow-100 text-yellow-800",
  BLOQUEADO: "bg-red-100 text-red-800",
};

const formatCurrency = (value: number | null) => {
  if (!value) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const PortfolioTable: React.FC<Props> = ({ data, isLoading, isError, onEdit }) => {
  const pagination = usePagination(data, { pageSize: 10 });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isError) return <div className="rounded-md border border-destructive p-8 text-center"><p className="text-destructive">Erro ao carregar dados.</p></div>;
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (data.length === 0) return <div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Nenhum portfólio cadastrado.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]" />
              <TableHead>Empresa</TableHead>
              <TableHead>Homologação</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-center">Qtd Est.</TableHead>
              <TableHead className="text-center">Cadastrados</TableHead>
              <TableHead className="text-center">Disponíveis</TableHead>
              <TableHead>Valor c/ Op.</TableHead>
              <TableHead>Valor s/ Op.</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((p) => {
              const isExpanded = expandedRows.has(p.id);
              const qtdEstimada = p.quantidade_estimada || 0;
              const qtdCadastrada = p.quantidade_cadastrada || 0;
              const qtdDisponivel = p.quantidade_disponivel || 0;
              const isComplete = qtdEstimada > 0 && qtdCadastrada >= qtdEstimada;

              const equipamentoLabel = p.variacao_label || p.catalogo_descricao || p.tipo_equipamento_descricao || "-";

              return (
                <React.Fragment key={p.id}>
                  <TableRow className="cursor-pointer" onClick={() => toggleRow(p.id)}>
                    <TableCell className="px-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="font-medium">{p.empresa_nome || "-"}</TableCell>
                    <TableCell>
                      {p.status_homologacao ? (
                        <Badge variant="outline" className={homologacaoConfig[p.status_homologacao] || ""}>{p.status_homologacao}</Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{equipamentoLabel}</TableCell>
                    <TableCell>{p.fabricante || "-"}</TableCell>
                    <TableCell>{p.modelo || "-"}</TableCell>
                    <TableCell className="text-center">{qtdEstimada || "-"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={isComplete ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                        {qtdCadastrada}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {qtdDisponivel > 0 ? (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800">{qtdDisponivel}</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800">0</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(p.valor_ref_com_operador)}</TableCell>
                    <TableCell>{formatCurrency(p.valor_ref_sem_operador)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={12} className="bg-muted/50 px-8 py-4">
                        <div className="space-y-2">
                          <div className="flex gap-6 text-sm flex-wrap">
                            <span>Capacidade estimada: <strong>{qtdEstimada}</strong></span>
                            <span>Cadastrados: <strong>{qtdCadastrada}</strong></span>
                            <span>Disponíveis: <strong>{qtdDisponivel}</strong></span>
                            {p.ano_fabricacao && <span>Ano: <strong>{p.ano_fabricacao}</strong></span>}
                          </div>
                          {p.observacoes && <p className="text-sm text-muted-foreground">Obs: {p.observacoes}</p>}
                          {isComplete && (
                            <p className="text-sm text-green-600 font-medium">✓ Capacidade totalmente cadastrada</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default PortfolioTable;
