/**
 * CT-3B — Etapa 1: itens solicitados.
 *
 * Lista todos os itens da solicitação com o progresso real vindo dos contadores
 * da RPC. Escolher um item leva à etapa de seleção de ativos.
 */
import React from "react";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ItemSolicitadoCard from "./ItemSolicitadoCard";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";

export const EtapaItens: React.FC = () => {
  const {
    itens,
    contadoresDoItem,
    atendimentosLoading,
    capabilities,
    selecionarItem,
    irParaEtapa,
  } = useCtSolicitacao();

  if (itens.length === 0) {
    return (
      <Alert data-testid="ct3b-sem-itens">
        <AlertDescription className="text-xs">
          Esta solicitação está no modelo legado (sem itens). As operações da Central do Transporte
          exigem itens cadastrados.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3" data-testid="ct3b-etapa-itens-body">
      {atendimentosLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando contadores...
        </div>
      )}

      {itens.map((item) => (
        <ItemSolicitadoCard
          key={item.id}
          item={item}
          contadores={contadoresDoItem(item.id)}
          podeSelecionar={capabilities.canVisualizar}
          onSelecionar={() => {
            selecionarItem(item.id);
            irParaEtapa("SELECAO");
          }}
        />
      ))}
    </div>
  );
};

export default EtapaItens;
