import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useApontamentosItem } from "@/hooks/ordemDiariaCampo/useApontamentosItem";
import type { ApontamentoItem } from "@/services/ordemDiariaCampo/apontamentoService";

const STATUS_LABEL: Record<ApontamentoItem["status_execucao"], string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  impedido: "Impedido",
  paralisado: "Paralisado",
};

const STATUS_VARIANT: Record<
  ApontamentoItem["status_execucao"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  em_andamento: "secondary",
  concluido: "default",
  impedido: "destructive",
  paralisado: "destructive",
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}

interface Props {
  itemId: string;
}

export const ApontamentoItemHistorico: React.FC<Props> = ({ itemId }) => {
  const { data, isLoading } = useApontamentosItem(itemId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const apontamentos = data ?? [];
  if (apontamentos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Nenhum apontamento registrado ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {apontamentos.map((a) => {
        const perc = a.percentual_realizado ?? null;
        const acima100 = perc != null && perc > 100;
        return (
          <Card key={a.id} className="p-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANT[a.status_execucao]} className="text-[10px]">
                {STATUS_LABEL[a.status_execucao]}
              </Badge>
              {perc != null && (
                <Badge
                  variant={acima100 ? "destructive" : "outline"}
                  className="text-[10px]"
                >
                  {perc}%{acima100 ? " (acima da meta)" : ""}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto">
                {formatDateTime(a.registrado_em)}
              </span>
            </div>

            <div className="text-xs text-muted-foreground">
              Por{" "}
              <span className="text-foreground font-medium">
                {a.registrado_por_nome_snapshot}
              </span>
            </div>

            {a.quantidade_executada != null && (
              <div className="text-xs">
                Executado:{" "}
                <span className="font-medium">
                  {a.quantidade_executada} {a.unidade_snapshot ?? ""}
                </span>
                {a.meta_dia_snapshot != null && (
                  <span className="text-muted-foreground">
                    {" "}
                    / meta {a.meta_dia_snapshot} {a.unidade_snapshot ?? ""}
                  </span>
                )}
              </div>
            )}

            {a.meta_dia_origem && a.meta_dia_origem !== "nao_informada" && (
              <p className="text-[10px] text-muted-foreground">
                Origem da meta: {a.meta_dia_origem.replace(/_/g, " ")}
              </p>
            )}

            {a.motivo_impedimento && (
              <p className="text-xs">
                <span className="font-semibold">Motivo:</span> {a.motivo_impedimento}
              </p>
            )}
            {a.observacao && (
              <p className="text-xs whitespace-pre-wrap">
                <span className="font-semibold">Obs.:</span> {a.observacao}
              </p>
            )}

            {a.equipe_presente_snapshot?.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Presentes:{" "}
                {a.equipe_presente_snapshot
                  .map((m) => m.nome ?? m.funcionario_id ?? "?")
                  .join(", ")}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
};
