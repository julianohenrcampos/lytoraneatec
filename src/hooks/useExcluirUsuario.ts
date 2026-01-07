import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProfileType } from "@/types/permissao";

export const useExcluirUsuario = (onSuccess?: () => void) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ProfileType | null>(null);

  const openDeleteDialog = (profile: ProfileType) => {
    setUserToDelete(profile);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setUserToDelete(null);
  };

  const excluirUsuario = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);

    try {
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId: userToDelete.id }
      });

      if (response.error) {
        console.error('Edge function error:', response.error);
        toast.error(response.error.message || "Erro ao excluir usuário");
        return;
      }

      const data = response.data;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.partial) {
        toast.warning("Usuário parcialmente excluído. " + data.error);
      } else {
        toast.success(`Usuário ${userToDelete.email} excluído com sucesso`);
      }

      closeDeleteDialog();
      onSuccess?.();

    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || "Erro ao excluir usuário");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isDeleting,
    isDeleteDialogOpen,
    userToDelete,
    openDeleteDialog,
    closeDeleteDialog,
    excluirUsuario,
  };
};
