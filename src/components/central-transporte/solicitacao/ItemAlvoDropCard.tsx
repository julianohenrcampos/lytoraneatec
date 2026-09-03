/**
 * CT-3E / CT-7 — Card RECEPTIVO do item solicitado (dropzone dominante).
 *
 * O item é a incógnita: enquanto nenhum ativo estiver reservado, o slot convida
 * ao gesto ("Arraste um ativo aqui para vincular"). Soltar (ou clicar no
 * fallback) apenas dispara o MESMO fluxo de atribuição já existente
 * (`fn_ct_atendimento_atribuir` via modal). Zero regra nova no cliente.
 */
import React, { useState } from "react";
import { MousePointerSquareDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtAtendimento, CtContadores } from "@/types/centralTransporteCT2";
import { CT_ATENDIMENTO_STATUS_LABELS } from "@/types/centralTransporteCT2";
import { CT_DND_MIME_ATIVO } from "./AtivoMiniCard";
import { capacidadeLabelItem, descricaoItem } from "./itemDisplay";

interface Props {
  item: SolicitacaoItem;
  contadores: CtContadores | null;
  atendimentos: CtAtendimento[];
  emFoco: boolean;
  podeReceber: boolean;
  onFocar: () => void;
  /** Recebe o equipamento arrastado (o vínculo real segue pelo fluxo CT-2). */
  onSoltarAtivo?: (equipamentoId: string) => void;
}

const rotuloAtendimento = (a: CtAtendimento): string =>
  [a.equipamento_frota, a.equipamento_numero].filter(Boolean).join("-") ||
  a.equipamento_placa ||
  a.equipamento_id.slice(0, 8);

const Num: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({
  label,
  value,
  testId,
}) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold" data-testid={testId}>
      {value}
    </span>
  </div>
);

export const ItemAlvoDropCard: React.FC<Props> = ({
  item,
  contadores,
  atendimentos,
  emFoco,
  podeReceber,
  onFocar,
  onSoltarAtivo,
}) => {
  const [sobre, setSobre] = useState(false);
  const vinculados = atendimentos.filter(
    (a) => a.status === "RESERVADO" || a.status === "EM_TRANSPORTE" || a.status === "ENTREGUE",
  );
  const pendentes = contadores?.pendentes ?? item.quantidade;
  const completo = pendentes === 0;
  const temVinculo = vinculados.length > 0;

  return (
    <Card
      data-testid={`ct3e-item-alvo-${item.id}`}
      data-completo={completo ? "true" : "false"}
      data-sobre={sobre ? "true" : "false"}
      data-receptivo="true"
      className={cn(
        "transition-colors",
        emFoco && "border-emerald-600/60 bg-emerald-600/[0.04] shadow-sm",
        completo && "border-emerald-600/50 bg-emerald-600/5",
        sobre && "border-primary bg-primary/10 ring-2 ring-primary/40",
      )}
      onDragOver={(e) => {
        if (!podeReceber || !onSoltarAtivo) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        setSobre(false);
        if (!podeReceber || !onSoltarAtivo) return;
        e.preventDefault();
        const id =
          e.dataTransfer.getData(CT_DND_MIME_ATIVO) || e.dataTransfer.getData("text/plain");
        if (id) onSoltarAtivo(id);
      }}
    >
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <h4 className="text-base font-semibold leading-tight">{descricaoItem(item)}</h4>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[11px]">
              {item.tipo_item}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {capacidadeLabelItem(item)}
            </Badge>
          </div>
        </div>

        {/* Dropzone dominante — alvo grande e acolhedor do gesto direita → esquerda. */}
        <div
          className={cn(
            "flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
            sobre ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/30",
          )}
          data-testid={`ct7-dropzone-${item.id}`}
        >
          <MousePointerSquareDashed
            className="h-6 w-6 text-muted-foreground"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            {temVinculo
              ? "Arraste um novo ativo para substituir ou vincular"
              : "Arraste um ativo aqui para vincular"}
          </p>
        </div>

        <div className="space-y-1 rounded-md border p-3">
          <Num label="Qtd solicitada" value={item.quantidade} />
          <Num label="Qtd reservada" value={contadores?.reservado ?? "—"} />
          <Num
            label="Pendentes"
            value={pendentes}
            testId={`ct3e-item-pendentes-${item.id}`}
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ativo escolhido</p>
          {!temVinculo ? (
            <p className="text-sm font-semibold" data-testid={`ct3e-item-incognita-${item.id}`}>
              ( ? )
            </p>
          ) : (
            <div
              className="flex flex-wrap gap-1.5"
              data-testid={`ct3e-item-vinculado-${item.id}`}
            >
              {vinculados.map((a) => (
                <Badge key={a.id} className="text-[11px]" variant="secondary">
                  {rotuloAtendimento(a)} — {CT_ATENDIMENTO_STATUS_LABELS[a.status]}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant={emFoco ? "default" : "outline"}
          className="w-full"
          data-testid={`ct3e-focar-item-${item.id}`}
          onClick={onFocar}
        >
          {temVinculo ? "Alterar seleção" : emFoco ? "Item em foco" : "Escolher ativo"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ItemAlvoDropCard;
