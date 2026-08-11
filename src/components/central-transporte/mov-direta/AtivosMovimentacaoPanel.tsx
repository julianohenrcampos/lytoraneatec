/**
 * CT-4 UX — Painel lateral "Ativos da movimentação" (master do master/detail).
 *
 * IMPORTANTE (semântica): esta coluna NÃO é o catálogo de Caminhões e
 * Equipamentos. Ela lista SOMENTE os ativos escolhidos para a movimentação
 * atual. A busca no catálogo vive exclusivamente no seletor aberto por
 * "+ Planejar ativo".
 *
 * Nenhuma regra nova: a elegibilidade vem do servidor (`elegivel`) e o status da
 * viagem define Rascunho × Programado.
 */
import React from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
  type CtMovDiretaRascunho,
} from "@/types/centralTransporteMovDireta";

export type StatusAtivoPlanejado = "SEM_PARADA" | "RASCUNHO" | "PROGRAMADO";

const ROTULO: Record<StatusAtivoPlanejado, string> = {
  SEM_PARADA: "Rascunho",
  RASCUNHO: "Rascunho",
  PROGRAMADO: "Programado",
};

const CLASSE: Record<StatusAtivoPlanejado, string> = {
  SEM_PARADA: "border-primary/40 bg-primary/5",
  RASCUNHO: "border-primary/40 bg-primary/5",
  PROGRAMADO: "border-emerald-600/50 bg-emerald-600/10",
};

export interface AtivosMovimentacaoPanelProps {
  /** IDs dos ativos participantes da movimentação atual, na ordem de leitura. */
  planejados: string[];
  /** Dados de catálogo já conhecidos (lookup por equipamento_id). */
  catalogo: Map<string, CtAtivoMovimentacao>;
  rascunho: CtMovDiretaRascunho;
  /** Rótulo curto da origem da coleta da viagem. */
  origemLabel: string | null;
  /** Equipamento em foco no editor único da direita. */
  ativoSelecionado: string | null;
  /** Rótulo curto por parada, na ordem do rascunho. */
  rotuloParada: (indice: number) => string;
  /** Se a viagem já foi programada (status ≠ RASCUNHO). */
  viagemProgramada: boolean;
  somenteLeitura: boolean;
  onSelecionarAtivo: (equipamentoId: string) => void;
  onAbrirSeletor: () => void;
  onRemoverAtivo?: (equipamentoId: string) => void;
}

export const AtivosMovimentacaoPanel: React.FC<AtivosMovimentacaoPanelProps> = ({
  planejados,
  catalogo,
  rascunho,
  origemLabel,
  ativoSelecionado,
  rotuloParada,
  viagemProgramada,
  somenteLeitura,
  onSelecionarAtivo,
  onAbrirSeletor,
  onRemoverAtivo,
}) => {
  const porAtivo = new Map<string, { indice: number; chaveLocal: string }>();
  rascunho.paradas.forEach((p, i) => {
    p.equipamentos.forEach((e) => porAtivo.set(e, { indice: i, chaveLocal: p.chaveLocal }));
  });

  const statusDe = (id: string): StatusAtivoPlanejado => {
    if (!porAtivo.has(id)) return "SEM_PARADA";
    return viagemProgramada ? "PROGRAMADO" : "RASCUNHO";
  };

  return (
    <Card className="lg:sticky lg:top-4 lg:self-start" data-testid="ct4-painel-ativos">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
          Ativos da movimentação
          <Badge variant="outline" className="text-[10px]">
            {planejados.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="max-h-[52vh] space-y-1.5 overflow-y-auto px-4 pb-3 text-xs">
        {planejados.length === 0 ? (
          <div className="space-y-1" data-testid="ct4-painel-ativos-vazio">
            <p className="text-[11px] text-muted-foreground">
              Nenhum ativo planejado nesta movimentação.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Use “+ Planejar ativo” para selecionar um ativo existente.
            </p>
          </div>
        ) : (
          planejados.map((id) => {
            const a = catalogo.get(id) ?? null;
            const st = statusDe(id);
            const alocacao = porAtivo.get(id) ?? null;
            const selecionado = id === ativoSelecionado;
            return (
              <div
                key={id}
                className={`flex items-start gap-1 rounded-md border px-2 py-1.5 leading-tight transition-colors hover:bg-muted/50 ${
                  selecionado ? "border-primary bg-primary/5" : ""
                }`}
                data-testid={`ct4-card-ativo-${id}`}
                data-status={st}
                data-selecionado={selecionado ? "true" : "false"}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelecionarAtivo(id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">
                      {a ? rotuloAtivoMovimentacao(a) : id.slice(0, 8)}
                    </p>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${CLASSE[st]}`}>
                      {ROTULO[st]}
                    </Badge>
                  </div>
                  {(a?.modelo || a?.tipoAtivo) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[a?.tipoAtivo, a?.modelo].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {alocacao ? (
                    <p className="truncate text-[11px] text-primary">
                      {origemLabel ?? "Origem não definida"} → {rotuloParada(alocacao.indice)}
                    </p>
                  ) : (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {origemLabel ?? a?.centroCustoLabel ?? "Origem atual não informada"} → ainda
                      sem destino
                    </p>
                  )}
                  {!alocacao && a?.centroCustoLabel && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      Origem atual: {a.centroCustoLabel}
                    </p>
                  )}
                </button>
                {!somenteLeitura && onRemoverAtivo && (
                  <button
                    type="button"
                    aria-label="Remover ativo da movimentação"
                    className="mt-0.5 text-muted-foreground hover:text-destructive"
                    data-testid={`ct4-remover-ativo-${id}`}
                    onClick={() => onRemoverAtivo(id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </CardContent>

      {!somenteLeitura && (
        <CardContent className="space-y-1 border-t px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-full gap-1 text-[11px]"
            onClick={onAbrirSeletor}
            data-testid="ct4-planejar-ativo"
          >
            <Plus className="h-3.5 w-3.5" /> Planejar ativo
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Somente ativos com registro de disponibilidade e sem compromisso podem ser planejados.
          </p>
        </CardContent>
      )}
    </Card>
  );
};

export default AtivosMovimentacaoPanel;
