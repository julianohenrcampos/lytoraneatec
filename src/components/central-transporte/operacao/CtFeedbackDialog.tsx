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
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  aberto: boolean;
  tipo: "SUCESSO" | "ERRO";
  titulo: string;
  mensagem?: string | null;
  onFechar: () => void;
  onTentarNovamente?: () => void;
}

/**
 * CT-3E.3 — Feedback central (padrão AlertDialog do ERP) para confirmar ou
 * recusar materialmente uma gravação. Em erro o modal de origem permanece.
 */
const CtFeedbackDialog: React.FC<Props> = ({
  aberto,
  tipo,
  titulo,
  mensagem,
  onFechar,
  onTentarNovamente,
}) => (
  <AlertDialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
    <AlertDialogContent data-testid={`ct3e-feedback-${tipo.toLowerCase()}`}>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 text-base">
          {tipo === "SUCESSO" ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          {titulo}
        </AlertDialogTitle>
        {mensagem && (
          <AlertDialogDescription className="text-xs">{mensagem}</AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        {tipo === "ERRO" && onTentarNovamente ? (
          <>
            <AlertDialogCancel className="text-xs">Fechar</AlertDialogCancel>
            <AlertDialogAction className="text-xs" onClick={onTentarNovamente}>
              Tentar novamente
            </AlertDialogAction>
          </>
        ) : (
          <AlertDialogAction className="text-xs" onClick={onFechar}>
            OK
          </AlertDialogAction>
        )}
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default CtFeedbackDialog;
