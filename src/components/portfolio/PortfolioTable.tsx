import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, CheckCircle, XCircle } from "lucide-react";
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

const PortfolioTable: React.FC<Props> = ({ data, isLoading, isError, onEdit }) => {
  const pagination = usePagination(data, { pageSize: 10 });

  if (isError) return <div className="rounded-md border border-destructive p-8 text-center"><p className="text-destructive">Erro ao carregar dados.</p></div>;
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (data.length === 0) return <div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Nenhum portfólio cadastrado.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Homologação</TableHead>
              <TableHead>Tipo Equipamento</TableHead>
              <TableHead className="text-center">Qtd Est.</TableHead>
              <TableHead className="text-center">C/ Operador</TableHead>
              <TableHead className="text-center">S/ Operador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.empresa_nome || "-"}</TableCell>
                <TableCell>
                  {p.status_homologacao ? (
                    <Badge variant="outline" className={homologacaoConfig[p.status_homologacao] || ""}>{p.status_homologacao}</Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>{p.tipo_equipamento_descricao || "-"}</TableCell>
                <TableCell className="text-center">{p.quantidade_estimada ?? "-"}</TableCell>
                <TableCell className="text-center">{p.fornece_com_operador ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}</TableCell>
                <TableCell className="text-center">{p.fornece_sem_operador ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}</TableCell>
                <TableCell><Badge variant="outline" className={p.ativo ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default PortfolioTable;
