import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import TabIntro from "../shared/TabIntro";
import { AlertTriangle } from "lucide-react";
import PendenciasSemanaList from "../plano-semanal/PendenciasSemanaList";
import { usePendenciasOperacionais } from "@/hooks/planejamentoMacro/usePendenciasOperacionais";

interface Props {
  planejamentoId: string | null;
}

const PendenciasTab: React.FC<Props> = ({ planejamentoId }) => {
  const { pendencias, isLoading } = usePendenciasOperacionais({ planejamentoId });

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <TabIntro text="Lista de recursos do planejamento que precisam de ajuste ou mapeamento antes da execução: funções sem cadastro, equipamentos sem tipo reconhecido, materiais sem unidade, atividades sem datas e itens fora do escopo operacional." />
        <TabHeader
          title="Saneamento / Pendências"
          description="Recursos do planejamento que precisam de ajuste/mapeamento antes da execução."
        />
        {!planejamentoId ? (
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Sem planejamento vigente"
            description="Importe ou ative um planejamento vigente para diagnosticar pendências."
          />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Carregando…</p>
        ) : (
          <PendenciasSemanaList pendencias={pendencias} />
        )}
      </CardContent>
    </Card>
  );
};

export default PendenciasTab;
