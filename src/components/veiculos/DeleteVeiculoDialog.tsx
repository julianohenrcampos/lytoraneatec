
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
import { Veiculo } from "@/types/veiculo";

interface DeleteVeiculoDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  veiculo: Veiculo | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteVeiculoDialog: React.FC<DeleteVeiculoDialogProps> = ({
  isOpen,
  isDeleting,
  veiculo,
  onClose,
  onConfirm,
}) => {
  if (!veiculo) {
    return null;
  }

  const tipoLabel = veiculo.nome_categoria || 'Ativo';

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {tipoLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o {tipoLabel.toLowerCase()}{' '}
            <span className="font-semibold">
              {veiculo.placa ? `${veiculo.fabricante} ${veiculo.nome_subcategoria || ''} - Placa ${veiculo.placa}` : 
                `${veiculo.fabricante} ${veiculo.nome_subcategoria || ''}` }
            </span>
            ?
            <br />
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteVeiculoDialog;
