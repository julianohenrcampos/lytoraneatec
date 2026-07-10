import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { ApontamentoItemModal } from "./ApontamentoItemModal";
import { ApontamentoItemHistorico } from "./ApontamentoItemHistorico";
import type { OrdemDiariaItem } from "@/types/ordemDiariaObra";

interface Props {
  item: OrdemDiariaItem;
}

export const CampoApontamentoBloco: React.FC<Props> = ({ item }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <ClipboardCheck className="h-4 w-4 mr-2" />
        Iniciar apontamento
      </Button>

      <div className="space-y-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico de apontamentos
        </h3>
        <ApontamentoItemHistorico itemId={item.id} />
      </div>

      <ApontamentoItemModal open={open} onOpenChange={setOpen} item={item} />
    </div>
  );
};
