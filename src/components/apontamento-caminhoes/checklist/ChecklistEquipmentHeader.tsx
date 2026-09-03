import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIA_IDS } from "@/constants/categorias";
import type { VeiculoDropdownItem } from "@/hooks/useApontamentoCaminhoes";
import { Truck } from "lucide-react";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

interface Props {
  veiculo: VeiculoDropdownItem | null;
  operadorNome: string;
  data: string | null;
  medidorLabel: string;
  medidorValor: number | string | null;
  centroCustoLabel: string | null;
}

const ChecklistEquipmentHeader: React.FC<Props> = ({
  veiculo,
  operadorNome,
  data,
  medidorLabel,
  medidorValor,
  centroCustoLabel,
}) => {
  const frotaPlaca = veiculo
    ? [
        [veiculo.frota, veiculo.numero_frota].filter(Boolean).join(" ").trim(),
        veiculo.placa || "",
      ]
        .filter(Boolean)
        .join(" · ") || "—"
    : "—";

  const subcategoria = veiculo?.nome_subcategoria || veiculo?.nome_categoria || null;
  const isVeiculo = veiculo?.categoria_ativo_id === CATEGORIA_IDS.VEICULO;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start">
          <div className="shrink-0 w-full sm:w-32 h-24 sm:h-32 rounded-md bg-muted flex items-center justify-center overflow-hidden border">
            {veiculo && (veiculo as any).imagem_url ? (
              <img
                src={(veiculo as any).imagem_url as string}
                alt={frotaPlaca}
                className="object-contain w-full h-full"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Truck className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="hidden sm:block w-px self-stretch bg-border" />
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs sm:text-sm">
            <div className="col-span-2 sm:col-span-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-base truncate">{frotaPlaca}</span>
              {subcategoria && (
                <Badge variant="secondary" className="text-[10px] font-medium">
                  {subcategoria}
                </Badge>
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Operador</div>
              <div className="truncate font-medium">{operadorNome || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Data</div>
              <div className="font-medium">
                {data ? formatBrazilianDateForDisplay(data) : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">{isVeiculo ? "KM" : medidorLabel}</div>
              <div className="font-medium">{medidorValor ?? "—"}</div>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <div className="text-muted-foreground">Centro de Custo</div>
              <div className="truncate font-medium">{centroCustoLabel || "—"}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChecklistEquipmentHeader;
