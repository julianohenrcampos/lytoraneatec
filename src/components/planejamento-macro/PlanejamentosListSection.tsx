// Fase 6E.1.3 — Empty state = texto discreto; com itens = lista compacta colapsável. Botões de importação vivem no header da página.
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  MoreVertical,
  Pencil,
  Archive,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarDataBR } from "./shared/formatData";
import { StatusBadge } from "./shared/StatusBadge";
import type { PlanejamentoObraRow } from "@/services/planejamentoMacro/planejamentoMacroService";

interface Props {
  planejamentos: PlanejamentoObraRow[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  onImportar?: () => void;
  onNovoManual?: () => void;
  onEdit: (p: PlanejamentoObraRow) => void;
  onTornarVigente: (p: PlanejamentoObraRow) => void;
  onArquivar: (p: PlanejamentoObraRow) => void;
  onExcluir: (p: PlanejamentoObraRow) => void;
}

const Row: React.FC<{
  p: PlanejamentoObraRow;
  onEdit: () => void;
  onTornarVigente: () => void;
  onArquivar: () => void;
  onExcluir: () => void;
}> = ({ p, onEdit, onTornarVigente, onArquivar, onExcluir }) => {
  const isVigente = p.status === "vigente";
  const podeExcluir = p.status !== "vigente";
  const hint =
    p.status === "rascunho"
      ? "Rascunho importado. Revise as atividades antes de tornar vigente."
      : p.status === "vigente"
        ? "Versão vigente utilizada como base de visualização do planejamento."
        : null;
  return (
    <div
      className={cn(
        "rounded-md border border-border px-3 py-2",
        isVigente && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr_auto] items-center gap-2 md:gap-4">
        <div className="text-sm">
          <span className="font-medium">
            {formatarDataBR(p.periodo_inicio)} → {formatarDataBR(p.periodo_fim)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">v{p.versao}</div>
        <div>
          <StatusBadge status={p.status} />
        </div>
        <div className="text-sm text-muted-foreground capitalize">{p.origem}</div>
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ações">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              {p.status === "rascunho" && (
                <DropdownMenuItem onClick={onTornarVigente}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Tornar vigente
                </DropdownMenuItem>
              )}
              {p.status === "vigente" && (
                <DropdownMenuItem onClick={onArquivar}>
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onExcluir}
                disabled={!podeExcluir}
                className={cn(podeExcluir && "text-destructive focus:text-destructive")}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
      )}
    </div>
  );
};

const PlanejamentosListSection: React.FC<Props> = ({
  planejamentos,
  isLoading,
  onEdit,
  onTornarVigente,
  onArquivar,
  onExcluir,
}) => {
  const [open, setOpen] = useState(true);
  const count = planejamentos.length;

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  if (count === 0) {
    return (
      <p className="text-sm text-muted-foreground px-1">
        Nenhum planejamento importado para este Centro de Custo.
      </p>
    );
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2 pt-4">
          <CollapsibleTrigger asChild>
            <button className="flex flex-col items-start gap-0.5 text-left w-full">
              <div className="flex items-center gap-2">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    !open && "-rotate-90"
                  )}
                />
                <CardTitle className="text-base">
                  Planejamentos deste Centro de Custo
                </CardTitle>
                <span className="text-xs text-muted-foreground">({count})</span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Versões importadas de cronograma. Edições manuais permitidas.
              </p>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="hidden md:grid md:grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr_auto] gap-4 px-3 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <div>Período</div>
              <div>Versão</div>
              <div>Status</div>
              <div>Origem</div>
              <div className="w-8" />
            </div>
            <div className="space-y-2">
              {planejamentos.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  onEdit={() => onEdit(p)}
                  onTornarVigente={() => onTornarVigente(p)}
                  onArquivar={() => onArquivar(p)}
                  onExcluir={() => onExcluir(p)}
                />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default PlanejamentosListSection;
