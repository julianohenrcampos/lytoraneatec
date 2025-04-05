
import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { ApontamentoCaminhao } from "@/services/apontamentoCaminhoesService";
import { cn } from "@/lib/utils";

interface ApontamentoCaminhoesTableProps {
  apontamentos: ApontamentoCaminhao[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const ApontamentoCaminhoesTable: React.FC<ApontamentoCaminhoesTableProps> = ({
  apontamentos,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Data</TableHead>
            <TableHead className="min-w-[200px]">Caminhão/Equipamento</TableHead>
            <TableHead className="min-w-[150px]">Operador</TableHead>
            <TableHead className="text-center">Abastecimento (L)</TableHead>
            <TableHead className="text-center">Horímetro Inicial</TableHead>
            <TableHead className="text-center">Horímetro Final</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                Carregando...
              </TableCell>
            </TableRow>
          ) : apontamentos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          ) : (
            apontamentos.map((apontamento) => (
              <TableRow key={apontamento.id}>
                <TableCell className="font-medium">
                  {apontamento.data
                    ? format(new Date(apontamento.data), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </TableCell>
                <TableCell>{apontamento.veiculo_identificacao || "-"}</TableCell>
                <TableCell>{apontamento.nome_operador || "-"}</TableCell>
                <TableCell className="text-center">
                  {apontamento.abastecimento || "-"}
                </TableCell>
                <TableCell className="text-center">
                  {apontamento.horimetro_inicial || "-"}
                </TableCell>
                <TableCell className="text-center">
                  {apontamento.horimetro_final || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(apontamento.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(apontamento.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(apontamento.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ApontamentoCaminhoesTable;
