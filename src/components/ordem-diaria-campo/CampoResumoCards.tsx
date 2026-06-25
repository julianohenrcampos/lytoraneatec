import React from "react";
import { Card } from "@/components/ui/card";

interface ResumoItem {
  label: string;
  value: number | string;
  destaque?: "default" | "warn" | "danger";
}

interface Props {
  itens: ResumoItem[];
}

export const CampoResumoCards: React.FC<Props> = ({ itens }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 px-4">
      {itens.map((it) => (
        <Card
          key={it.label}
          className={
            "p-3 flex flex-col items-center justify-center text-center " +
            (it.destaque === "danger"
              ? "border-destructive/50 bg-destructive/5"
              : it.destaque === "warn"
                ? "border-amber-400/60 bg-amber-50 dark:bg-amber-950/30"
                : "")
          }
        >
          <span className="text-xl font-bold leading-none">{it.value}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
            {it.label}
          </span>
        </Card>
      ))}
    </div>
  );
};
