import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Trash2, User, Mail } from 'lucide-react';
import { ProfileType } from '@/types/permissao';

interface RemoveAllPermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileType | null;
  onConfirm: () => Promise<void>;
  isRemoving?: boolean;
}

const RemoveAllPermissionsDialog: React.FC<RemoveAllPermissionsDialogProps> = ({
  isOpen,
  onClose,
  profile,
  onConfirm,
  isRemoving = false,
}) => {
  const [confirmChecked, setConfirmChecked] = useState(false);

  const handleClose = () => {
    setConfirmChecked(false);
    onClose();
  };

  const handleConfirm = async () => {
    await onConfirm();
    setConfirmChecked(false);
    onClose();
  };

  if (!profile) return null;

  const adminFunctions = profile.funcoes?.filter(f => f !== 'user') || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Remoção de Permissões
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            Você está prestes a remover <strong>TODAS</strong> as permissões administrativas de:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações do usuário */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{profile.nome_completo || 'Sem nome'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{profile.email || 'Sem email'}</span>
            </div>
          </div>

          {/* Lista de funções que serão removidas */}
          {adminFunctions.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Funções que serão removidas:</p>
              <ul className="space-y-1">
                {adminFunctions.map((funcao) => (
                  <li key={funcao} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    <span>{funcao}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Aviso */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Esta ação não pode ser desfeita automaticamente
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Você precisará atribuir novas permissões manualmente se necessário.
            </p>
          </div>

          {/* Checkbox de confirmação */}
          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="confirm-removal"
              checked={confirmChecked}
              onCheckedChange={(checked) => setConfirmChecked(checked === true)}
            />
            <label
              htmlFor="confirm-removal"
              className="text-sm leading-tight cursor-pointer"
            >
              Confirmo que este usuário não precisa mais de acesso administrativo
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRemoving}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!confirmChecked || isRemoving}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isRemoving ? 'Removendo...' : 'Remover Todas Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoveAllPermissionsDialog;
