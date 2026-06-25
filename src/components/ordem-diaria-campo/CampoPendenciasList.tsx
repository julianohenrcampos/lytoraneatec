import React from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { PendenciaSnapshotItem } from "@/types/ordemDiariaObra";

interface Props {
  pendencias: PendenciaSnapshotItem[];
}

export const CampoPendenciasList: React.FC<Props> = ({ pendencias }) => {
  if (!pendencias?.length) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sem pendências registradas no snapshot.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {pendencias.map((p, i) => (
        <li key={i}>
          <Card className="p-3 flex items-start gap-2 border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              {p.tipo && (
                <p className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-400">
                  {p.tipo}
                </p>
              )}
              <p className="text-sm break-words">{p.descricao}</p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
};
