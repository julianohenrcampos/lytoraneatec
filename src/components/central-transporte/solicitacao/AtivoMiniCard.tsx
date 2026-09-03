/**
 * CT-3E / CT-8 — Mini-card COMPACTO de ativo candidato (arrastável).
 *
 * Apresentação apenas: a elegibilidade vem de `toCandidateSelection` e o tom
 * visual de `tomDoCandidato`. Toda ação de arrastar possui fallback por clique.
 *
 * Densidade CT-8: 3 linhas no máximo —
 *   linha 1: [código]                 [origem curta / CC]
 *   linha 2: [status resumido]        [Compat.: X]
 *   linha 3: [botão Vincular]
 * Textos longos viram `title`/tooltip — nunca parágrafos.
 */
import React from "react";
import { cn } from "@/lib/utils";
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type { CtCandidateSelection } from "@/types/centralTransporteCT2";
import { tomDoCandidato } from "@/utils/central-transporte/ativoTomVisual";

export const CT_DND_MIME_ATIVO = "application/x-lytotec-ct-ativo";

export const rotuloCurtoAtivo = (a: AtivoAnalise): string =>
  [a.frota, a.numero_frota].filter(Boolean).join("-") || a.placa || a.equipamento_id.slice(0, 8);

interface Props {
  ativo: AtivoAnalise;
  candidato: CtCandidateSelection | null;
  selecionado?: boolean;
  desabilitado?: boolean;
  onSelecionar: () => void;
  /** Fallback acessível sem drag: vincular direto ao item em foco. */
  onVincular?: () => void;
}

export const AtivoMiniCard: React.FC<Props> = ({
  ativo,
  candidato,
  selecionado = false,
  desabilitado = false,
  onSelecionar,
  onVincular,
}) => {
  const tom = tomDoCandidato(candidato);
  /** Origem curta: departamento OU centro de custo — uma linha, sem parágrafo. */
  const origemCurta =
    ativo.departamento_nome ||
    ativo.centro_custo_codigo ||
    ativo.centro_custo_nome ||
    "Sem departamento";
  const detalhe =
    ativo.motivo_compatibilidade ||
    [ativo.centro_custo_codigo, ativo.centro_custo_nome].filter(Boolean).join(" — ") ||
    undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!desabilitado}
      aria-pressed={selecionado}
      aria-label={`Ativo ${rotuloCurtoAtivo(ativo)} — ${tom.label}`}
      data-testid={`ct3e-ativo-card-${ativo.equipamento_id}`}
      data-tom={tom.tom}
      onDragStart={(e) => {
        e.dataTransfer.setData(CT_DND_MIME_ATIVO, ativo.equipamento_id);
        e.dataTransfer.setData("text/plain", ativo.equipamento_id);
        e.dataTransfer.effectAllowed = "copy";
        onSelecionar();
      }}
      onClick={onSelecionar}
      onDoubleClick={() => onVincular?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelecionar();
        }
      }}
      className={cn(
        "flex min-w-0 cursor-grab flex-col justify-between gap-1 rounded-md border px-2 py-1.5 text-left transition-colors",
        tom.classes,
        selecionado && "ring-2 ring-primary",
        desabilitado && "cursor-not-allowed opacity-60",
      )}
    >
      {/* linha 1 — código + origem curta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", tom.pontoClasses)} aria-hidden />
          <span className="truncate text-sm font-semibold">{rotuloCurtoAtivo(ativo)}</span>
        </div>
        <span
          className="max-w-[52%] truncate text-[11px] text-muted-foreground"
          title={detalhe ?? origemCurta}
        >
          {origemCurta}
        </span>
      </div>

      {/* linha 2 — status resumido + compatibilidade */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium" title={tom.label}>
          {tom.label}
          {candidato?.jaNoCentroCustoDestino && (
            <span
              className="ml-1 font-medium text-emerald-700 dark:text-emerald-300"
              title="Já está no destino — atendimento local"
              data-testid={`ct3e-ja-no-destino-${ativo.equipamento_id}`}
            >
              · no destino
            </span>
          )}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          Compat.: {ativo.compatibilidade === "EXATA" ? "Exata" : "Parcial"}
        </span>
      </div>

      {/* linha 3 — fallback sem drag */}
      {onVincular && (
        <button
          type="button"
          className="w-full rounded border px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
          data-testid={`ct3e-ativo-vincular-${ativo.equipamento_id}`}
          disabled={desabilitado}
          onClick={(e) => {
            e.stopPropagation();
            onVincular();
          }}
        >
          Vincular
        </button>
      )}
    </div>
  );
};

export default AtivoMiniCard;
