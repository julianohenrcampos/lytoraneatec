// Fase 6F.2.1 — Card vigente compacto (botão "Ver versões" agora vive só no header da página).
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Archive, Trash2 } from "lucide-react";
import type { PlanejamentoObraRow } from "@/services/planejamentoMacro/planejamentoMacroService";
import { formatarDataBR } from "./shared/formatData";
import { StatusBadge } from "./shared/StatusBadge";

interface Props {
  planejamento: PlanejamentoObraRow;
  isSuperAdmin: boolean;
  onEdit: () => void;
  onArchive: () => void;
}

const PlanejamentoVigenteCard: React.FC<Props> = ({
  planejamento,
  isSuperAdmin,
  onEdit,
  onArchive,
}) => {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base">Planejamento vigente</CardTitle>
          <StatusBadge status={planejamento.status} />
        </div>
        {isSuperAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ações do planejamento">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir (arquive antes)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Período: </span>
            <span className="font-medium">
              {formatarDataBR(planejamento.periodo_inicio)} → {formatarDataBR(planejamento.periodo_fim)}
            </span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            <span className="text-muted-foreground">Versão: </span>
            <span className="font-medium">v{planejamento.versao}</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            <span className="text-muted-foreground">Origem: </span>
            <span className="font-medium capitalize">{planejamento.origem}</span>
          </span>
        </div>
        {planejamento.observacao && (
          <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
            {planejamento.observacao}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanejamentoVigenteCard;
