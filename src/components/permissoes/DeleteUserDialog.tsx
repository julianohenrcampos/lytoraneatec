import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle, UserX, Mail, User } from "lucide-react";
import { ProfileType } from "@/types/permissao";

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileType | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({
  isOpen,
  onClose,
  profile,
  onConfirm,
  isDeleting,
}) => {
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState("");

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmChecked(false);
      setEmailConfirmation("");
    }
  }, [isOpen]);

  const isEmailMatch = emailConfirmation.toLowerCase() === (profile?.email || "").toLowerCase();
  const canDelete = confirmChecked && isEmailMatch && !isDeleting;

  const handleConfirm = async () => {
    if (canDelete) {
      await onConfirm();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <UserX className="h-5 w-5" />
            Excluir Usuário Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>Você está prestes a excluir permanentemente:</p>
              
              {/* User info card */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{profile?.nome_completo || "Nome não informado"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{profile?.email}</span>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-destructive/10 border border-destructive/30 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-destructive">ATENÇÃO: Esta ação é IRREVERSÍVEL!</p>
                    <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                      <li>O usuário não poderá mais fazer login</li>
                      <li>Todos os dados do perfil serão perdidos</li>
                      <li>Esta ação não pode ser desfeita</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Confirmation checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="confirm-delete"
                  checked={confirmChecked}
                  onCheckedChange={(checked) => setConfirmChecked(checked === true)}
                  disabled={isDeleting}
                />
                <Label 
                  htmlFor="confirm-delete" 
                  className="text-sm cursor-pointer leading-relaxed"
                >
                  Entendo que esta ação é permanente e irreversível
                </Label>
              </div>

              {/* Email confirmation */}
              <div className="space-y-2">
                <Label htmlFor="email-confirm" className="text-sm">
                  Digite o email do usuário para confirmar:
                </Label>
                <Input
                  id="email-confirm"
                  type="email"
                  placeholder={profile?.email}
                  value={emailConfirmation}
                  onChange={(e) => setEmailConfirmation(e.target.value)}
                  disabled={isDeleting}
                  className={emailConfirmation && !isEmailMatch ? "border-destructive" : ""}
                />
                {emailConfirmation && !isEmailMatch && (
                  <p className="text-xs text-destructive">O email não corresponde</p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Excluindo...
              </>
            ) : (
              <>
                <UserX className="h-4 w-4 mr-2" />
                Excluir Usuário
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteUserDialog;
