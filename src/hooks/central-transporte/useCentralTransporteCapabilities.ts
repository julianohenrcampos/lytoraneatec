/**
 * CT-2 / M4 — Capabilities da Central do Transporte.
 * Fonte única: usePermission().hasActionPermission sobre a permission
 * gestao_maquinas_central_transporte_view.
 */
import { usePermission } from "@/hooks/usePermission";

export const CT_PERMISSION = "gestao_maquinas_central_transporte_view";

export interface CentralTransporteCapabilities {
  canVisualizar: boolean;
  canCriar: boolean;
  canEditar: boolean;
  canAprovar: boolean;
  isLoading: boolean;
}

export const useCentralTransporteCapabilities = (): CentralTransporteCapabilities => {
  const { hasActionPermission, isLoading } = usePermission();

  return {
    canVisualizar: !isLoading && hasActionPermission(CT_PERMISSION, "visualizar"),
    canCriar: !isLoading && hasActionPermission(CT_PERMISSION, "criar"),
    canEditar: !isLoading && hasActionPermission(CT_PERMISSION, "editar"),
    canAprovar: !isLoading && hasActionPermission(CT_PERMISSION, "aprovar"),
    isLoading,
  };
};

export default useCentralTransporteCapabilities;
