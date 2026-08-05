/**
 * CT-3B — Card/linha de item solicitado com progresso real da RPC.
 *
 * Um único selo de progresso (derivado dos contadores) + barra composta.
 * Nada é contado no frontend: apenas larguras são calculadas.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtContadores } from "@/types/centralTransporteCT2";
import {
  capacidadeLabelItem,
  descricaoItem,
  PROGRESSO_CLASSE,
  PROGRESSO_LABELS,
  progressoDoItem,
  segmentosProgresso,
} from "./itemDisplay";

interface Props {
  item: SolicitacaoItem;
  contadores: CtContadores | null;
  onSelecionar: () => void;
  podeSelecionar: boolean;
}

const Num: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({
  label,
  value,
  testId,
}) => (
  <div className="flex flex-col" data-testid={testId}>
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

export const ItemSolicitadoCard: React.FC<Props> = ({
  item,
  contadores,
  onSelecionar,
  podeSelecionar,
}) => {
  const progresso = progressoDoItem(item.quantidade, contadores);
  const segmentos = segmentosProgresso(item.quantidade, contadores);

  return (
    <Card data-testid={`ct3b-item-card-${item.id}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{descricaoItem(item)}</span>
          <Badge variant="outline" className="text-[10px]">
            {item.tipo_item}
          </Badge>
          <Badge
            className={`text-[10px] ${PROGRESSO_CLASSE[progresso]}`}
            data-testid={`ct3b-item-progresso-${item.id}`}
          >
            {PROGRESSO_LABELS[progresso]}
          </Badge>
        </div>

        {/* Barra composta: entregues → em transporte → reservados → pendentes. */}
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Progresso do item: ${PROGRESSO_LABELS[progresso]}`}
          data-testid={`ct3b-item-barra-${item.id}`}
        >
          {segmentos.map((seg) => (
            <div
              key={seg.key}
              className={seg.classe}
              style={{ width: `${seg.percentual}%` }}
              title={`${seg.label}: ${seg.value}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Num label="Solicitado" value={item.quantidade} />
          <Num label="Reservados" value={contadores?.reservado ?? "—"} />
          <Num label="Em transporte" value={contadores?.em_transporte ?? "—"} />
          <Num label="Entregues" value={contadores?.entregue ?? "—"} />
          <Num
            label="Pendentes"
            value={contadores?.pendentes ?? "—"}
            testId={`ct3b-item-pendentes-${item.id}`}
          />
          <Num label="Capacidade" value={capacidadeLabelItem(item)} />
        </div>

        <Button
          size="sm"
          className="w-full sm:w-auto"
          data-testid={`ct3b-selecionar-${item.id}`}
          disabled={!podeSelecionar}
          onClick={onSelecionar}
        >
          Selecionar ativos
        </Button>
      </CardContent>
    </Card>
  );
};

export default ItemSolicitadoCard;
