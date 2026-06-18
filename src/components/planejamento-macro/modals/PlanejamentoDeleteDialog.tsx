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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  submitting?: boolean;
}

const PlanejamentoDeleteDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir planejamento?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Todas as atividades vinculadas
            (existentes ou futuras) serão removidas em cascade junto com o
            planejamento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={submitting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {submitting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PlanejamentoDeleteDialog;
