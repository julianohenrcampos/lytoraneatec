import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, User } from "lucide-react";
import type { OrdemDiariaItem } from "@/types/ordemDiariaCampo";

interface Props {
  item: OrdemDiariaItem;
  ordemDataLabel?: string;
  onAbrir: () => void;
}

export const CampoTarefaCard: React.FC<Props> = ({ item, ordemDataLabel, onAbrir }) => {
  const qtd = item.atividade_quantidade_planejada_snapshot;
  const unidade = item.atividade_unidade_medida_snapshot;
  const perc = Math.max(0, Math.min(100, item.percentual_snapshot ?? 0));
  const pendencias = item.pendencias_snapshot ?? [];
  const isCritica = item.atividade_is_critica_snapshot === true;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isCritica && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" /> Crítica
              </Badge>
            )}
            {item.codigo_eap_snapshot && (
              <Badge variant="outline" className="text-[10px]">
                EAP {item.codigo_eap_snapshot}
              </Badge>
            )}
            {ordemDataLabel && (
              <Badge variant="secondary" className="text-[10px]">
                {ordemDataLabel}
              </Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold leading-tight mt-1 break-words">
            {item.nome_atividade_snapshot}
          </h3>
        </div>
      </div>

      {(qtd != null || unidade) && (
        <div className="text-xs text-muted-foreground">
          Quantidade prevista:{" "}
          <span className="font-medium text-foreground">
            {qtd != null ? qtd : "—"} {unidade ?? ""}
          </span>
        </div>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Progresso ({item.fonte_progresso_snapshot ?? "—"})</span>
          <span>{perc}%</span>
        </div>
        <Progress value={perc} className="h-1.5" />
      </div>

      {item.responsavel_item_nome_snapshot && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate">{item.responsavel_item_nome_snapshot}</span>
        </div>
      )}

      {pendencias.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pendencias.slice(0, 3).map((p, i) => (
            <Badge key={i} variant="outline" className="text-[10px] border-amber-400/60">
              {p.tipo ?? "Pendência"}
            </Badge>
          ))}
          {pendencias.length > 3 && (
            <Badge variant="outline" className="text-[10px]">
              +{pendencias.length - 3}
            </Badge>
          )}
        </div>
      )}

      <Button
        size="sm"
        variant="secondary"
        className="w-full mt-1"
        onClick={onAbrir}
      >
        Abrir tarefa <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </Card>
  );
};
