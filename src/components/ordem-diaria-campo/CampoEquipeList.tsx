import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EquipeSnapshotItem } from "@/types/ordemDiariaObra";

interface Props {
  equipe: EquipeSnapshotItem[];
}

export const CampoEquipeList: React.FC<Props> = ({ equipe }) => {
  if (!equipe?.length) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Sem equipe definida no snapshot.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {equipe.map((p, i) => (
        <li key={`${p.funcionario_id ?? i}`}>
          <Card className="p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {p.nome ?? "Sem nome"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {p.funcao ?? "—"} {p.papel_na_tarefa ? `· ${p.papel_na_tarefa}` : ""}
              </p>
            </div>
            <div className="text-right">
              {p.horas_previstas != null && (
                <Badge variant="outline" className="text-[10px]">
                  {p.horas_previstas}h
                </Badge>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
};
