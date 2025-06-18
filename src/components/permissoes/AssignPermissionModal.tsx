
import React from "react";
import { UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProfileType } from "@/types/permissao";

interface AssignPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileType | null;
  availableFunctions: string[];
  onAssign: (profileId: string, funcaoString: string) => void;
  isSubmitting: boolean;
}

const AssignPermissionModal: React.FC<AssignPermissionModalProps> = ({
  isOpen,
  onClose,
  profile,
  availableFunctions,
  onAssign,
  isSubmitting,
}) => {
  const [selectedFuncao, setSelectedFuncao] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen && profile) {
      // Limpar seleção ao abrir o modal
      setSelectedFuncao("");
    }
  }, [isOpen, profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile && selectedFuncao) {
      onAssign(profile.id, selectedFuncao);
    }
  };

  if (!profile) return null;

  // Verificar se já tem permissões
  const currentFunctions = profile.funcoes || [];
  const hasPermissions = currentFunctions.length > 0 && 
    (currentFunctions.length > 1 || (currentFunctions.length === 1 && currentFunctions[0] !== 'user'));
  
  const isEditing = hasPermissions;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {isEditing ? "Permissionamento - Editar" : "Permissionamento - Atribuir"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Alterar as permissões para ${profile.nome_completo || profile.email}`
              : `Atribuir permissões para ${profile.nome_completo || profile.email}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usuario">Usuário</Label>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {profile.imagem_url ? (
                <img
                  src={profile.imagem_url}
                  alt={profile.nome_completo || "Usuário"}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
              )}
              <div>
                <p className="font-medium">{profile.nome_completo || "Nome não informado"}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
          </div>

          {/* Mostrar funções atuais se houver */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Funções Atuais</Label>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  {currentFunctions.filter(f => f !== 'user').join(', ') || 'Nenhuma função especial'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="funcao">
              {isEditing ? "Adicionar Nova Função *" : "Função *"}
            </Label>
            <Select value={selectedFuncao} onValueChange={setSelectedFuncao} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma função" />
              </SelectTrigger>
              <SelectContent>
                {availableFunctions.map((funcao) => (
                  <SelectItem 
                    key={funcao} 
                    value={funcao}
                    disabled={currentFunctions.includes(funcao)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{funcao}</span>
                      {currentFunctions.includes(funcao) && (
                        <span className="text-xs text-muted-foreground ml-2">(já possui)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedFuncao || isSubmitting}>
              {isSubmitting 
                ? (isEditing ? "Adicionando..." : "Atribuindo...") 
                : (isEditing ? "Adicionar" : "Atribuir")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AssignPermissionModal;
