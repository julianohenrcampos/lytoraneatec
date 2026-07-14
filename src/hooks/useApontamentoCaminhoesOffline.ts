/**
 * @deprecated Fase 0 (Apontamento C&E) — o fluxo antigo `createApontamento` foi
 * removido. O modo offline será reintroduzido em fase posterior com o mesmo
 * contrato transacional da RPC `fn_salvar_apontamento_ce_com_inspecao`.
 */

import { useState } from "react";
import { useConnectionStatus } from "./useConnectionStatus";
import { useToast } from "./use-toast";
import { usePermission } from "./usePermission";

export const useApontamentoCaminhoesOffline = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { isSupabaseConnected } = useConnectionStatus();
  const { toast } = useToast();
  const { isSuperAdmin, permissions } = usePermission();

  const submitApontamento = async (
    _formData: unknown,
    _onSuccess?: () => void
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const canAccess =
        isSuperAdmin || permissions.includes("requisicoes_apontamento_caminhoes_view");
      if (!canAccess) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para este módulo.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Modo offline indisponível",
        description:
          "Modo offline do Apontamento de C&E ainda não está habilitado. Utilize a página online.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitApontamento,
    isLoading,
    isOffline: !isSupabaseConnected,
  };
};
