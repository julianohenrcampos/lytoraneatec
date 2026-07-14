import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ChecklistCeGrupoDef } from "@/constants/checklistCeTemplates";
import { resolverGrupoVisual } from "./checklistGroupVisuals";

interface Props {
  grupo: ChecklistCeGrupoDef;
  respondidos: number;
  naoConformes?: number;
  aberto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const ChecklistGrupo: React.FC<Props> = ({
  grupo,
  respondidos,
  naoConformes = 0,
  aberto,
  onToggle,
  children,
}) => {
  const total = grupo.itens.length;
  const visual = resolverGrupoVisual(grupo.icone || grupo.titulo);
  const Icon = visual.icon;

  return (
    <div
      className={cn(
        "rounded-lg shadow-sm bg-card overflow-hidden",
        visual.borderClassName
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors",
          visual.headerClassName
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn("shrink-0", visual.iconContainerClassName)}>
            <Icon className={cn("h-4 w-4", visual.iconClassName)} />
          </span>
          <span className="font-semibold uppercase text-sm tracking-wide truncate">
            {grupo.titulo}
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] rounded-full bg-muted text-foreground/80"
          >
            {respondidos}/{total}
          </Badge>
          {naoConformes > 0 && (
            <Badge className="text-[10px] rounded-full bg-red-100 text-red-800 hover:bg-red-100">
              {naoConformes} não conforme{naoConformes > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-180")}
        />
      </button>
      {aberto && <div className="p-3 space-y-3 border-t bg-background">{children}</div>}
    </div>
  );
};

export default ChecklistGrupo;
