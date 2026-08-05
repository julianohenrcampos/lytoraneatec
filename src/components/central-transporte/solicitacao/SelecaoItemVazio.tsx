/**
 * CT-3B.2 — Estado inicial colapsado da Etapa "Seleção dos ativos".
 *
 * Sem ?item= válido: apenas título, seletor de item e orientação.
 * Nenhuma busca, filtro, aba, candidato, painel, atendimento ou ação.
 */
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtContadores } from "@/types/centralTransporteCT2";
import ItemSelectorBar from "./ItemSelectorBar";
import { TEXTO_ORIENTACAO_ITEM } from "@/utils/central-transporte/selecaoProgressiva";

interface Props {
  itens: SolicitacaoItem[];
  contadoresDoItem: (itemId: string | null) => CtContadores | null;
  onSelecionarItem: (itemId: string) => void;
  onVerTodosItens: () => void;
}

export const SelecaoItemVazio: React.FC<Props> = ({
  itens,
  contadoresDoItem,
  onSelecionarItem,
  onVerTodosItens,
}) => (
  <div className="space-y-3" data-testid="ct3b2-selecao-vazia">
    <h3 className="text-sm font-semibold">Seleção dos ativos</h3>

    <ItemSelectorBar
      itens={itens}
      itemSelecionadoId={null}
      contadoresDoItem={contadoresDoItem}
      onSelecionarItem={onSelecionarItem}
      onVerTodosItens={onVerTodosItens}
    />

    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground" data-testid="ct3b2-orientacao-item">
          {TEXTO_ORIENTACAO_ITEM}
        </p>
      </CardContent>
    </Card>
  </div>
);

export default SelecaoItemVazio;
