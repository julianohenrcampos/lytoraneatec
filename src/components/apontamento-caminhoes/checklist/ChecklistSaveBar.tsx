import React from "react";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface Props {
  respondidosObrigatorios: number;
  totalObrigatorios: number;
  pendencias: number;
  naoConformes: number;
  showInitialHint?: boolean;
}

const ChecklistSaveBar: React.FC<Props> = ({
  respondidosObrigatorios,
  totalObrigatorios,
  pendencias,
  naoConformes,
  showInitialHint,
}) => {
  const completo = respondidosObrigatorios >= totalObrigatorios;
  const mostraDica = showInitialHint && completo && naoConformes === 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm px-3 py-2 bg-muted/40 border rounded-md">
        <Badge
          variant={completo ? "secondary" : "outline"}
          className={
            completo ? "rounded-full bg-emerald-100 text-emerald-800" : "rounded-full"
          }
        >
          {respondidosObrigatorios}/{totalObrigatorios} respondidos
        </Badge>
        {pendencias > 0 && (
          <Badge variant="destructive" className="rounded-full">
            {pendencias} pendência{pendencias > 1 ? "s" : ""}
          </Badge>
        )}
        {naoConformes > 0 && (
          <Badge className="rounded-full bg-red-100 text-red-800 hover:bg-red-100">
            {naoConformes} não conforme{naoConformes > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {mostraDica && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs sm:text-sm">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Todos os itens iniciam como Conforme. Revise e altere as exceções.</span>
        </div>
      )}
    </div>
  );
};

export default ChecklistSaveBar;
