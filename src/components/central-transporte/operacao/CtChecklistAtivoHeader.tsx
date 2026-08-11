import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";
import type { CtOrdemCarga } from "@/types/centralTransporteMobilizacao";
import { rotuloCarga } from "@/lib/central-transporte/checklistCeCt";

interface Props {
  carga: CtOrdemCarga | null;
  templateNome: string;
  viagemCodigo: string;
  origem: string | null;
  destino: string | null;
}

/** CT-3E.3 — cabeçalho do ativo com a mesma leitura visual do Apontamento C&E. */
const CtChecklistAtivoHeader: React.FC<Props> = ({
  carga,
  templateNome,
  viagemCodigo,
  origem,
  destino,
}) => {
  const titulo = carga ? rotuloCarga(carga) : "Conjunto transportador";

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
          <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted sm:h-28 sm:w-32">
            {carga?.imagemUrl ? (
              <img
                src={carga.imagemUrl}
                alt={titulo}
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Truck className="h-9 w-9 text-muted-foreground" />
            )}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-3">
              <span className="truncate text-base font-semibold">{titulo}</span>
              {carga?.subcategoriaNome && (
                <Badge variant="secondary" className="text-[10px]">
                  {carga.subcategoriaNome}
                </Badge>
              )}
              {carga?.tipoAtivo && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {carga.tipoAtivo}
                </Badge>
              )}
            </div>
            <div>
              <div className="text-muted-foreground">Placa</div>
              <div className="font-medium">{carga?.placa ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Checklist</div>
              <div className="truncate font-medium">{templateNome}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Viagem</div>
              <div className="font-medium">{viagemCodigo}</div>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <div className="text-muted-foreground">Trajeto</div>
              <div className="truncate font-medium">
                {(origem ?? "—") + " → " + (destino ?? "—")}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CtChecklistAtivoHeader;
