import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Package } from "lucide-react";
import { CatalogoEquipamento } from "@/services/catalogoEquipamentoService";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface Props {
  data: CatalogoEquipamento[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (item: CatalogoEquipamento) => void;
}

const CatalogoTable: React.FC<Props> = ({ data, isLoading, isError, onEdit }) => {
  const pagination = usePagination(data, { pageSize: 10 });

  if (isError) return <div className="rounded-md border border-destructive p-8 text-center"><p className="text-destructive">Erro ao carregar dados.</p></div>;
  if (isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  if (data.length === 0) return <div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Nenhum item no catálogo.</p></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Img</TableHead>
              <TableHead>Tipo Equipamento</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Capacidade</TableHead>
              <TableHead>Potência</TableHead>
              <TableHead>Combustível</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.imagem_url ? (
                    <img src={c.imagem_url} className="w-8 h-8 rounded object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{c.tipo_equipamento_descricao || "-"}</TableCell>
                <TableCell>{c.fabricante_nome || "-"}</TableCell>
                <TableCell>{c.modelo_nome || "-"}</TableCell>
                <TableCell>{c.capacidade || "-"}</TableCell>
                <TableCell>{c.potencia || "-"}</TableCell>
                <TableCell>{c.combustivel || "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={c.ativo ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></Button>
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

export default CatalogoTable;
