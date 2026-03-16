
import { Veiculo, VeiculoFormData } from "@/types/veiculo";

export interface VeiculoFilter {
  placa?: string;
  fabricante?: string;
  modelo?: string;
  tipo_veiculo?: string;
  frota?: string;
  departamento_id?: string;
  situacao?: string;
  empresa_id?: string;
  categoria_ativo_id?: string;
}

export interface ImportResult {
  success: Veiculo[];
  errors: { message: string }[];
}

// Re-export these types from @/types/veiculo
export type { Veiculo, VeiculoFormData };
