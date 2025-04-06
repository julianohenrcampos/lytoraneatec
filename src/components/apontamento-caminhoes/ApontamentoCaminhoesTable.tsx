
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
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

  // Empty state component
  const EmptyState = () => (
    <TableRow>
      <TableCell 
        colSpan={isMobile ? 3 : 7} 
        className="h-24 text-center"
      >
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-gray-500 mb-1">Nenhum registro encontrado.</p>
          <p className="text-sm text-gray-400">
            {isMobile ? "Tente ajustar os filtros avançados." : "Tente ajustar os filtros de busca."}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );

  // Loading state component
  const LoadingState = () => (
    <TableRow>
      <TableCell 
        colSpan={isMobile ? 3 : 7} 
        className="h-24 text-center"
      >
        Carregando...
      </TableCell>
    </TableRow>
  );

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Data</TableHead>
            <TableHead className="min-w-[200px]">Caminhão/Equipamento</TableHead>
            {!isMobile && (
              <>
                <TableHead className="min-w-[150px]">Operador</TableHead>
                <TableHead className="text-center">Abastecimento (L)</TableHead>
                <TableHead className="text-center">Horímetro Inicial</TableHead>
                <TableHead className="text-center">Horímetro Final</TableHead>
              </>
            )}
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <LoadingState />
          ) : apontamentos.length === 0 ? (
            <EmptyState />
          ) : (
            apontamentos.map((apontamento) => (
              <TableRow key={apontamento.id}>
                <TableCell className="font-medium">
                  {apontamento.data
                    ? format(new Date(apontamento.data), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </TableCell>
                <TableCell>{apontamento.veiculo_identificacao || "-"}</TableCell>
                {!isMobile && (
                  <>
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
                  </>
                )}
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-1">
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
