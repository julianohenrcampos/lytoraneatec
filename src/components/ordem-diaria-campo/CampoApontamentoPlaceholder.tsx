import React from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface Props {
  label?: string;
}

export const CampoApontamentoPlaceholder: React.FC<Props> = ({
  label = "Iniciar apontamento",
}) => {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled
        aria-disabled="true"
        title="Funcionalidade em breve"
      >
        <Lock className="h-4 w-4 mr-2" />
        {label} — em breve
      </Button>
      <p className="text-[11px] text-center text-muted-foreground">
        Apontamento de produção e Diário de Obra serão liberados nas próximas
        fases.
      </p>
    </div>
  );
};
