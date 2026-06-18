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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  submitting?: boolean;
}

const PlanejamentoArchiveDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Arquivar planejamento vigente?</AlertDialogTitle>
          <AlertDialogDescription>
            O planejamento deixará de ser vigente. O módulo voltará a exibir
            dados simulados até que um novo planejamento seja ativado para este
            Centro de Custo. Você pode reativá-lo depois pela seção
            "Planejamentos deste Centro de Custo".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={submitting}>
            {submitting ? "Arquivando..." : "Arquivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PlanejamentoArchiveDialog;
