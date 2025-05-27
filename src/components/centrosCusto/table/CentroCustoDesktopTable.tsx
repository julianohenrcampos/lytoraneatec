
import React from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Eye, Trash } from "lucide-react";
import { CentroCusto } from "@/types/centroCusto";

interface CentroCustoDesktopTableProps {
  centrosCusto: CentroCusto[];
  onEdit: (centroCusto: CentroCusto) => void;
  onView: (centroCusto: CentroCusto) => void;
  onDelete: (centroCusto: CentroCusto) => void;
}

const CentroCustoDesktopTable: React.FC<CentroCustoDesktopTableProps> = ({
  centrosCusto,
  onEdit,
  onView,
  onDelete
}) => {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Código</TableHead>
                <TableHead className="w-[300px]">Nome do Centro de Custo</TableHead>
                <TableHead>CNPJ Vinculado</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {centrosCusto.map((centroCusto) => (
                <TableRow key={centroCusto.id}>
                  <TableCell>{centroCusto.codigo_centro_custo}</TableCell>
                  <TableCell 
                    className="font-medium cursor-pointer hover:text-primary"
                    onClick={() => onView(centroCusto)}
                  >
                    {centroCusto.nome_centro_custo}
                  </TableCell>
                  <TableCell>{centroCusto.cnpj_vinculado || "-"}</TableCell>
                  <TableCell>{centroCusto.telefone || "-"}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={centroCusto.situacao === "Ativo" ? "default" : "secondary"}
                      className={centroCusto.situacao === "Ativo" ? "bg-green-500 hover:bg-green-500/90" : "bg-gray-500 hover:bg-gray-500/90"}
                    >
                      {centroCusto.situacao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(centroCusto)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView(centroCusto)}
                        title="Visualizar"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(centroCusto)}
                        title="Excluir"
                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default CentroCustoDesktopTable;
