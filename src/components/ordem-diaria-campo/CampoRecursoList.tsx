import React from "react";
import { Card } from "@/components/ui/card";
import type { RecursoSnapshotItem } from "@/types/ordemDiariaObra";

interface Props {
  recursos: RecursoSnapshotItem[];
  emptyLabel: string;
}

export const CampoRecursoList: React.FC<Props> = ({ recursos, emptyLabel }) => {
  if (!recursos?.length) {
    return <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {recursos.map((r, i) => (
        <li key={i}>
          <Card className="p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.descricao}</p>
              {(r.grupo || r.familia) && (
                <p className="text-xs text-muted-foreground truncate">
                  {[r.grupo, r.familia].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
              {r.quantidade != null ? r.quantidade : "—"} {r.unidade ?? ""}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
};
