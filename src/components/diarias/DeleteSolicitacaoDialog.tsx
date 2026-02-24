import React, { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { checkSolicitacaoCanBeDeleted } from "@/services/diarias";

interface DeleteSolicitacaoDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  solicitacaoNumero: string | null;
  solicitacaoId: string | null;
}

const DeleteSolicitacaoDialog: React.FC<DeleteSolicitacaoDialogProps> = ({
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
  solicitacaoNumero,
  solicitacaoId,
}) => {
  const [validationInfo, setValidationInfo] = useState<{
    canDelete: boolean;
    details: {
      totalApontamentos: number;
      totalPresencas: number;
      totalAprovacoes: number;
      totalConvocacoes: number;
    };
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!solicitacaoId || !isOpen) {
        setValidationInfo(null);
        return;
      }
      setIsValidating(true);
      try {
        const result = await checkSolicitacaoCanBeDeleted(solicitacaoId);
        setValidationInfo(result);
      } catch (error) {
        console.error("Erro ao validar exclusão:", error);
        setValidationInfo({
          canDelete: true,
          details: { totalApontamentos: 0, totalPresencas: 0, totalAprovacoes: 0, totalConvocacoes: 0 },
        });
      } finally {
        setIsValidating(false);
      }
    };
    validate();
  }, [solicitacaoId, isOpen]);

  if (!solicitacaoId) return null;

  const { details } = validationInfo || {
    details: { totalApontamentos: 0, totalPresencas: 0, totalAprovacoes: 0, totalConvocacoes: 0 },
  };

  const hasDependencies =
    details.totalApontamentos > 0 ||
    details.totalPresencas > 0 ||
    details.totalAprovacoes > 0 ||
    details.totalConvocacoes > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div>
                Tem certeza que deseja excluir a solicitação{" "}
                <strong>#{solicitacaoNumero}</strong>?
              </div>

              {isValidating ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Verificando dependências...
                </div>
              ) : validationInfo && hasDependencies ? (
                <div className="space-y-3">
                  <div>
                    <strong>Esta ação também excluirá em cascata:</strong>
                    <ul className="mt-2 space-y-1 text-sm">
                      {details.totalApontamentos > 0 && (
                        <li className="flex items-center gap-2">
                          <Badge variant="secondary">{details.totalApontamentos}</Badge>
                          apontamento(s) de campo
                        </li>
                      )}
                      {details.totalPresencas > 0 && (
                        <li className="flex items-center gap-2">
                          <Badge variant="secondary">{details.totalPresencas}</Badge>
                          registro(s) de presença
                        </li>
                      )}
                      {details.totalConvocacoes > 0 && (
                        <li className="flex items-center gap-2">
                          <Badge variant="secondary">{details.totalConvocacoes}</Badge>
                          convocação(ões)
                        </li>
                      )}
                      {details.totalAprovacoes > 0 && (
                        <li className="flex items-center gap-2">
                          <Badge variant="secondary">{details.totalAprovacoes}</Badge>
                          registro(s) de aprovação
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <div className="text-orange-800 font-medium text-sm">
                      ⚠️ Esta ação não pode ser desfeita
                    </div>
                    <div className="text-xs text-orange-700 mt-1">
                      Todos os dados relacionados serão permanentemente excluídos.
                    </div>
                  </div>
                </div>
              ) : (
                !isValidating && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <div className="text-orange-800 font-medium text-sm">
                      ⚠️ Esta ação não pode ser desfeita
                    </div>
                  </div>
                )
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting || isValidating}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting || isValidating}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Excluindo...
              </>
            ) : (
              "Sim, excluir permanentemente"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteSolicitacaoDialog;
