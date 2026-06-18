import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Info, X } from "lucide-react";

interface Props {
  centroCustoId?: string | null;
}

const OrigemPlanejamentoMacroBanner: React.FC<Props> = ({ centroCustoId }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const ccRef = centroCustoId ? `#${centroCustoId.slice(0, 8)}` : null;

  return (
    <Alert className="relative border-primary/40 bg-primary/5 pr-10">
      <Info className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary">Origem: Planejamento Macro da Obra</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        Revise as informações e crie a solicitação manualmente pela tela oficial.
        {ccRef && (
          <div className="mt-1">
            Centro de Custo informado na origem:{" "}
            <span className="font-mono">{ccRef}</span>
          </div>
        )}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6"
        onClick={() => setDismissed(true)}
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
};

export default OrigemPlanejamentoMacroBanner;
