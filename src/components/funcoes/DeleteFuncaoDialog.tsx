
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
import { Loader2, AlertTriangle } from "lucide-react";
import { Funcao } from "@/types/funcao";

interface DeleteFuncaoDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  funcao: Funcao | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteFuncaoDialog: React.FC<DeleteFuncaoDialogProps> = ({
  isOpen,
  isDeleting,
  funcao,
  onClose,
  onConfirm
}) => {
  if (!funcao) return null;
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir Função
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Tem certeza que deseja excluir a função <strong>{funcao.nome_funcao}</strong>?
            </p>
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm font-medium text-destructive mb-1">
                ⚠️ Atenção: Esta ação não poderá ser desfeita.
              </p>
              <p className="text-xs text-muted-foreground">
                Se existirem funcionários vinculados a esta função, a exclusão será impedida.
                Primeiro transfira os funcionários para outras funções.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              "Sim, Excluir"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteFuncaoDialog;
