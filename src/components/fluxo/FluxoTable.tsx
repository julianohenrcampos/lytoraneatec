import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Copy, Trash2, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { FluxoAprovacao } from "@/types/fluxoAprovacao";

interface FluxoTableProps {
  fluxos: FluxoAprovacao[];
  isLoading: boolean;
  onEdit: (fluxo: FluxoAprovacao) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isDuplicating: boolean;
  isDeleting: boolean;
}

export default function FluxoTable({ fluxos, isLoading, onEdit, onDuplicate, onDelete, isDuplicating, isDeleting }: FluxoTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fluxos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum fluxo cadastrado. Crie o primeiro fluxo de aprovação.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-center">Etapas</TableHead>
            <TableHead className="text-center">CCs Vinculados</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Versão</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fluxos.map((fluxo) => (
            <TableRow key={fluxo.id}>
              <TableCell className="font-medium">{fluxo.nome}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                {fluxo.descricao || "—"}
              </TableCell>
              <TableCell className="text-center">{fluxo.etapas_count || 0}</TableCell>
              <TableCell className="text-center">{fluxo.vinculacoes_count || 0}</TableCell>
              <TableCell className="text-center">
                <Badge variant={fluxo.ativo ? "default" : "secondary"}>
                  {fluxo.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-muted-foreground">
                v{fluxo.versao}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(fluxo)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDuplicate(fluxo.id)}
                    disabled={isDuplicating}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir fluxo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação excluirá permanentemente o fluxo "{fluxo.nome}" e todas as suas etapas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(fluxo.id)} disabled={isDeleting}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
