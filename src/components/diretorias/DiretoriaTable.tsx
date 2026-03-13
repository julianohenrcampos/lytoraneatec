import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2 } from "lucide-react";
import { Diretoria } from "@/types/diretoria";

interface DiretoriaTableProps {
  diretorias: Diretoria[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onEdit: (diretoria: Diretoria) => void;
  onDelete: (diretoria: Diretoria) => void;
}

const TIPO_LABELS: Record<string, string> = {
  operacional: "Operacional",
  administrativa: "Administrativa",
  financeira: "Financeira",
  institucional: "Institucional",
  executiva: "Executiva",
};

const DiretoriaTable: React.FC<DiretoriaTableProps> = ({
  diretorias,
  isLoading,
  isError,
  onEdit,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-center text-destructive py-8">Erro ao carregar diretorias.</p>;
  }

  if (!diretorias?.length) {
    return <p className="text-center text-muted-foreground py-8">Nenhuma diretoria cadastrada.</p>;
  }

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome da Diretoria</TableHead>
            <TableHead>Diretor Responsável</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diretorias.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.nome}</TableCell>
              <TableCell>{d.diretor?.nome_completo || "—"}</TableCell>
              <TableCell>{TIPO_LABELS[d.tipo] || d.tipo}</TableCell>
              <TableCell>
                <Badge variant={d.ativo ? "default" : "secondary"}>
                  {d.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(d)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(d)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default DiretoriaTable;
