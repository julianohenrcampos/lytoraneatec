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
import { AlertTriangle, XCircle, CalendarOff, UserX } from "lucide-react";

interface StatusFuncionarioAlertProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'ferias' | 'afastado' | 'inativo' | 'inconsistencia';
  funcionarioNome: string;
  motivo: string;
  diasSemApontamento?: number;
  /** Para férias: permite solicitar como extraordinário */
  onSolicitarExtraordinario?: () => void;
}

export function StatusFuncionarioAlert({
  isOpen,
  onClose,
  tipo,
  funcionarioNome,
  motivo,
  diasSemApontamento,
  onSolicitarExtraordinario
}: StatusFuncionarioAlertProps) {
  const config = {
    ferias: {
      icon: CalendarOff,
      title: 'Funcionário em Férias',
      iconColor: 'text-orange-500',
      showExtraordinario: true
    },
    afastado: {
      icon: UserX,
      title: 'Funcionário Afastado',
      iconColor: 'text-destructive',
      showExtraordinario: false
    },
    inativo: {
      icon: XCircle,
      title: 'Funcionário Inativo',
      iconColor: 'text-destructive',
      showExtraordinario: false
    },
    inconsistencia: {
      icon: AlertTriangle,
      title: 'Inconsistência Detectada',
      iconColor: 'text-orange-500',
      showExtraordinario: false
    }
  };

  const cfg = config[tipo];
  const Icon = cfg.icon;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
            {cfg.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p className="font-medium text-foreground">{funcionarioNome}</p>
            <p>{motivo}</p>
            {diasSemApontamento && diasSemApontamento > 30 && (
              <p className="text-sm text-muted-foreground">
                Regularize o status do funcionário antes de continuar.
              </p>
            )}
            {cfg.showExtraordinario && (
              <p className="text-sm text-muted-foreground mt-2">
                Deseja solicitar como extraordinário? Isso enviará uma aprovação ao gerente.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="h-12 sm:h-10">Cancelar</AlertDialogCancel>
          {cfg.showExtraordinario && onSolicitarExtraordinario && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onSolicitarExtraordinario();
              }}
              className="h-12 sm:h-10 bg-orange-600 hover:bg-orange-700"
            >
              Solicitar Aprovação
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
