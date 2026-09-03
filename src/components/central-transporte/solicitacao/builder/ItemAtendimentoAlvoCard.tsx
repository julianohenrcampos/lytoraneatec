/**
 * CT-9 — Card COMPACTO do item solicitado dentro do Atendimento Builder.
 *
 * O item continua sendo o alvo do gesto (drop nativo de mini-card de ativo),
 * mas agora vive no CANVAS central, junto das viagens. Nenhuma regra nova:
 * soltar apenas dispara o mesmo fluxo CT-2 de atribuição já existente.
 */
import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, MousePointerSquareDashed, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtAtendimento, CtContadores } from "@/types/centralTransporteCT2";
import { CT_ATENDIMENTO_STATUS_LABELS } from "@/types/centralTransporteCT2";
import { CT_DND_MIME_ATIVO } from "../AtivoMiniCard";
import { capacidadeLabelItem, descricaoItem } from "../itemDisplay";

export const rotuloAtendimentoCurto = (a: CtAtendimento): string =>
  [a.equipamento_frota, a.equipamento_numero].filter(Boolean).join("-") ||
  a.equipamento_placa ||
  a.equipamento_id.slice(0, 8);

interface Props {
  item: SolicitacaoItem;
  contadores: CtContadores | null;
  atendimentos: CtAtendimento[];
  emFoco: boolean;
  podeReceber: boolean;
  onFocar: () => void;
  onSoltarAtivo?: (equipamentoId: string) => void;
  /** Troca de ativo pelo fluxo autoritativo de substituição (CT-2). */
  onSubstituir?: (atendimento: CtAtendimento) => void;
}

export const ItemAtendimentoAlvoCard: React.FC<Props> = ({
  item,
  contadores,
  atendimentos,
  emFoco,
  podeReceber,
  onFocar,
  onSoltarAtivo,
  onSubstituir,
}) => {
  const [sobre, setSobre] = useState(false);
  const vinculados = atendimentos.filter(
    (a) => a.status === "RESERVADO" || a.status === "EM_TRANSPORTE" || a.status === "ENTREGUE",
  );
  const pendentes = contadores?.pendentes ?? item.quantidade;
  const completo = pendentes === 0;
  const temVinculo = vinculados.length > 0;

  return (
    <div
      data-testid={`ct9-item-alvo-${item.id}`}
      data-completo={completo ? "true" : "false"}
      data-sobre={sobre ? "true" : "false"}
      data-receptivo="true"
      className={cn(
        "rounded-md border p-2 text-xs transition-colors",
        emFoco && "border-emerald-600/60 bg-emerald-600/[0.04]",
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">{descricaoItem(item)}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {item.tipo_item} · {capacidadeLabelItem(item)} · Qtd {item.quantidade} · Pendentes{" "}
            <span data-testid={`ct9-item-pendentes-${item.id}`}>{pendentes}</span>
          </p>
        </div>
        {completo ? (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-emerald-600/50 bg-emerald-600/10 text-[10px]"
          >
            <CheckCircle2 className="h-3 w-3" /> Atendido
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-amber-500/50 bg-amber-500/10 text-[10px]"
            data-testid={`ct9-pendencia-item-${item.id}`}
          >
            <AlertTriangle className="h-3 w-3" /> Item sem ativo
          </Badge>
        )}
      </div>

      {!temVinculo ? (
        <div
          className={cn(
            "mt-2 flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-2 py-2 text-center",
            sobre ? "border-primary bg-primary/10" : "border-muted-foreground/30 bg-muted/30",
          )}
          data-testid={`ct9-dropzone-${item.id}`}
        >
          <MousePointerSquareDashed className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p className="text-[11px] text-muted-foreground">Arraste um candidato aqui</p>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px]"
            data-testid={`ct9-escolher-ativo-${item.id}`}
            onClick={onFocar}
          >
            Escolher ativo
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Ativo escolhido
          </p>
          <div className="flex flex-wrap items-center gap-1" data-testid={`ct9-item-vinculado-${item.id}`}>
            {vinculados.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {rotuloAtendimentoCurto(a)} — {CT_ATENDIMENTO_STATUS_LABELS[a.status]}
                </Badge>
                {onSubstituir && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 gap-1 px-1 text-[10px]"
                    data-testid={`ct9-alterar-ativo-${a.id}`}
                    onClick={() => onSubstituir(a)}
                  >
                    <Repeat className="h-3 w-3" /> Alterar ativo
                  </Button>
                )}
              </span>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1 text-[10px]"
              data-testid={`ct9-focar-item-${item.id}`}
              onClick={onFocar}
            >
              {emFoco ? "Item em foco" : "Ver candidatos"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemAtendimentoAlvoCard;
