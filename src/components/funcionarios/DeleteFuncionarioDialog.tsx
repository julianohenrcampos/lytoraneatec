
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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export interface DeleteFuncionarioDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  funcionarioId?: string;
  funcionarioNome?: string;
  onClose: () => void;
  onConfirm: () => void;
  errorMessage?: string;
}

const DeleteFuncionarioDialog: React.FC<DeleteFuncionarioDialogProps> = ({
  isOpen,
  isDeleting,
  funcionarioId,
  funcionarioNome,
  onClose,
  onConfirm,
  errorMessage
}) => {
  if (!funcionarioId) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar funcionário</AlertDialogTitle>
          <AlertDialogDescription>
            {errorMessage ? (
              <div className="text-destructive font-medium mb-2">{errorMessage}</div>
            ) : (
              <>
                Tem certeza que deseja inativar o funcionário{" "}
                <span className="font-semibold">{funcionarioNome}</span>?
                <br />
                <br />
                O funcionário ficará com status <span className="font-semibold">Inativo</span>{" "}
                e não aparecerá em listagens operacionais. Todo o histórico, vínculos e
                auditoria serão <span className="font-semibold">preservados</span>.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          {!errorMessage && (
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inativando...
                  </>
                ) : (
                  "Inativar"
                )}
              </Button>
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteFuncionarioDialog;
