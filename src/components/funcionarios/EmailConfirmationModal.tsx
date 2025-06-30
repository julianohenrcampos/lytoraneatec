
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { confirmUserEmail } from "@/services/adminService";
import { Loader2, Mail } from "lucide-react";

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

const EmailConfirmationModal: React.FC<EmailConfirmationModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = ""
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [isConfirming, setIsConfirming] = useState(false);
  const { toast } = useToast();

  const handleConfirmEmail = async () => {
    if (!email.trim()) {
      toast({
        title: "Erro",
        description: "Digite um email válido",
        variant: "destructive",
      });
      return;
    }

    setIsConfirming(true);
    try {
      await confirmUserEmail(email);
      toast({
        title: "Sucesso",
        description: `Email ${email} confirmado com sucesso!`,
      });
      onClose();
      setEmail("");
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Confirmar Email do Usuário
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do usuário</Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isConfirming}
            />
          </div>
          
          <div className="text-sm text-muted-foreground">
            Esta ação irá marcar o email como confirmado no sistema de autenticação,
            permitindo que o usuário faça login normalmente.
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isConfirming}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmEmail}
              disabled={isConfirming || !email.trim()}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                "Confirmar Email"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailConfirmationModal;
