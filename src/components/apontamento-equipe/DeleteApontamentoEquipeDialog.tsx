
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApontamentoEquipe } from "@/types/apontamentoEquipe";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DeleteApontamentoEquipeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apontamento: ApontamentoEquipe | null;
  onDelete: () => void;
  isDeleting: boolean;
}

const DeleteApontamentoEquipeDialog: React.FC<DeleteApontamentoEquipeDialogProps> = ({
  isOpen,
  onClose,
  apontamento,
  onDelete,
  isDeleting,
}) => {
  if (!apontamento) return null;

  const equipeNome = apontamento.equipe?.nome_equipe || "N/A";
  const dataRegistro = format(new Date(apontamento.data_registro), "dd/MM/yyyy", { locale: ptBR });

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Isso excluirá permanentemente o apontamento da equipe{" "}
            <strong>{equipeNome}</strong> do dia <strong>{dataRegistro}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></span>
                Excluindo...
              </>
            ) : (
              "Continuar"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteApontamentoEquipeDialog;
