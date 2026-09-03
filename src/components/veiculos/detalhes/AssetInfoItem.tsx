import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface AssetInfoItemProps {
  icon?: LucideIcon;
  label: string;
  value?: React.ReactNode;
  valueClassName?: string;
  tooltip?: string;
  emptyLabel?: string;
}

const isEmpty = (value: React.ReactNode): boolean =>
  value === null || value === undefined || value === "" || value === false;

/**
 * Item de consulta do modal de detalhes do ativo.
 * Apenas apresentação — jamais formata/normaliza dados de negócio.
 */
const AssetInfoItem: React.FC<AssetInfoItemProps> = ({
  icon: Icon,
  label,
  value,
  valueClassName,
  tooltip,
  emptyLabel = "Não informado",
}) => {
  const vazio = isEmpty(value);
  const conteudo = (
    <p
      className={cn(
        "text-sm leading-snug break-words",
        vazio ? "text-muted-foreground/80 italic" : "font-medium text-foreground",
        valueClassName,
      )}
    >
      {vazio ? emptyLabel : value}
    </p>
  );

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {tooltip && !vazio ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  {conteudo}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          conteudo
        )}
      </div>
    </div>
  );
};

export default AssetInfoItem;
