
import React from "react";
import { UserCheck, AlertCircle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { ProfileType } from "@/types/permissao";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCanonicalPrimaryRole } from "@/utils/adminPermissionProfile";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "sonner";

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
  const { hasActionPermission } = usePermission();
  const canSubmit = hasActionPermission("admin_permissoes_view", "editar");

  // Buscar roles da tabela bd_roles (novo RBAC)
  const { data: rolesDB } = useQuery({
    queryKey: ['rbac-roles-for-assignment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_roles')
        .select('id, nome, descricao')
        .eq('ativo', true)
        .order('nome');
      
      if (error) {
        console.error('❌ Erro ao buscar roles:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: isOpen
  });

  React.useEffect(() => {
    if (isOpen && profile) {
      setSelectedFuncao("");
    }
  }, [isOpen, profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    if (profile && selectedFuncao) {
      onAssign(profile.id, selectedFuncao);
    }
  };

  if (!profile) return null;

  const currentRole = getCanonicalPrimaryRole(profile as any);
  const isEditing = !!currentRole;

  // Combine roles from DB
  const functionsFromDB = rolesDB?.map(f => f.nome) || [];
  const allAvailableFunctions = [...new Set([...availableFunctions, ...functionsFromDB])].sort();

  // Build combobox options
  const comboboxOptions = allAvailableFunctions.map((funcao) => ({
    value: funcao,
    label: funcao,
  }));

  const selectedFuncaoDescricao = selectedFuncao 
    ? rolesDB?.find(f => f.nome === selectedFuncao)?.descricao 
    : null;

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
              ? `Alterar a função de ${profile.nome_completo || profile.email}`
              : `Atribuir função para ${profile.nome_completo || profile.email}`}
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
                {currentRole && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Função atual: <span className="font-semibold">{currentRole}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Função do Sistema *</Label>
            <Combobox
              options={comboboxOptions}
              value={selectedFuncao}
              onChange={setSelectedFuncao}
              placeholder="Selecione uma função"
              searchPlaceholder="Buscar função..."
              emptyText="Nenhuma função encontrada"
            />
            {selectedFuncaoDescricao && (
              <p className="text-xs text-muted-foreground">{selectedFuncaoDescricao}</p>
            )}
          </div>

          {isEditing && selectedFuncao && selectedFuncao !== currentRole && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A função <strong>{currentRole}</strong> será substituída por <strong>{selectedFuncao}</strong>.
              </AlertDescription>
            </Alert>
          )}

          {selectedFuncao && ['SuperAdm', 'Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'].includes(selectedFuncao) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                ⚠️ <strong>Função administrativa selecionada</strong>
                <br />
                Este usuário terá <strong>acesso global</strong> a todos os dados por padrão.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedFuncao || isSubmitting || !canSubmit}>
              {isSubmitting 
                ? (isEditing ? "Substituindo..." : "Atribuindo...") 
                : (isEditing ? "Substituir" : "Atribuir")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AssignPermissionModal;
