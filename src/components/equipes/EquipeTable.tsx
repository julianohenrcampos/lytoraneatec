
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2 } from "lucide-react";
import { Equipe } from "@/types/equipe";
import { Card } from "@/components/ui/card";

interface EquipeTableProps {
  equipes: Equipe[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (equipe: Equipe) => void;
  onView: (equipe: Equipe) => void;
  onDelete: (equipe: Equipe) => void;
}

const EquipeTable: React.FC<EquipeTableProps> = ({
  equipes,
  isLoading,
  isError,
  onEdit,
  onView,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex justify-center">
          <div className="animate-pulse text-center">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-8">
        <div className="text-center text-destructive">
          <p>Ocorreu um erro ao carregar as equipes.</p>
          <p>Por favor, tente novamente mais tarde.</p>
        </div>
      </Card>
    );
  }

  if (equipes.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <p>Nenhuma equipe encontrada.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome da Equipe</TableHead>
            <TableHead>Encarregado</TableHead>
            <TableHead>Apontador</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipes.map((equipe) => (
            <TableRow key={equipe.id}>
              <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => onView(equipe)}>
                {equipe.nome_equipe}
              </TableCell>
              <TableCell>{equipe.encarregado?.nome_completo || "Não definido"}</TableCell>
              <TableCell>{equipe.apontador?.nome_completo || "Não definido"}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(equipe)}>
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onView(equipe)}>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">Visualizar</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(equipe)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Excluir</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EquipeTable;
