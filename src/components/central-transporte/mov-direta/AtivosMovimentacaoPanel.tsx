/**
 * CT-4 UX — Painel lateral "ATIVOS DA MOVIMENTAÇÃO".
 *
 * É APENAS uma projeção derivada: a união dos ativos escolhidos nas paradas de
 * entrega. Não tem busca, dropdown nem catálogo próprio — nunca é uma segunda
 * fonte de verdade. Clicar em um item apenas leva o foco à parada do ativo.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
  type CtMovDiretaRascunho,
} from "@/types/centralTransporteMovDireta";

export interface AtivosMovimentacaoPanelProps {
  /** IDs dos ativos presentes em alguma parada (união, na ordem de leitura). */
  planejados: string[];
  /** Metadados de catálogo já conhecidos (lookup por equipamento_id). */
  catalogo: Map<string, CtAtivoMovimentacao>;
  rascunho: CtMovDiretaRascunho;
  /** Equipamento em foco no editor da direita. */
  ativoSelecionado: string | null;
  /** Rótulo curto por parada, na ordem do rascunho. */
  rotuloParada: (indice: number) => string;
  onSelecionarAtivo: (equipamentoId: string) => void;
}

export const AtivosMovimentacaoPanel: React.FC<AtivosMovimentacaoPanelProps> = ({
  planejados,
  catalogo,
  rascunho,
  ativoSelecionado,
  rotuloParada,
  onSelecionarAtivo,
}) => {
  /** Paradas onde cada ativo aparece (projeção pura do rascunho). */
  const paradasDoAtivo = new Map<string, number[]>();
  rascunho.paradas.forEach((p, i) => {
    p.equipamentos.forEach((e) => {
      paradasDoAtivo.set(e, [...(paradasDoAtivo.get(e) ?? []), i]);
    });
  });

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

      <CardContent className="max-h-[52vh] space-y-1.5 overflow-y-auto px-4 pb-4 text-xs">
        {planejados.length === 0 ? (
          <div className="space-y-1" data-testid="ct4-painel-ativos-vazio">
            <p className="text-[11px] text-muted-foreground">
              Nenhum ativo adicionado à movimentação.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Selecione os ativos nas paradas de entrega.
            </p>
          </div>
        ) : (
          planejados.map((id) => {
            const a = catalogo.get(id) ?? null;
            const indices = paradasDoAtivo.get(id) ?? [];
            const selecionado = id === ativoSelecionado;
            return (
              <button
                key={id}
                type="button"
                className={`w-full rounded-md border px-2 py-1.5 text-left leading-tight transition-colors hover:bg-muted/50 ${
                  selecionado ? "border-primary bg-primary/5" : ""
                }`}
                data-testid={`ct4-card-ativo-${id}`}
                data-selecionado={selecionado ? "true" : "false"}
                onClick={() => onSelecionarAtivo(id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">
                    {a ? rotuloAtivoMovimentacao(a) : id.slice(0, 8)}
                  </p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {indices.map((i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {i + 1}ª · {rotuloParada(i)}
                      </Badge>
                    ))}
                  </div>
                </div>
                {(a?.modelo || a?.tipoAtivo) && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[a?.tipoAtivo, a?.modelo].filter(Boolean).join(" · ")}
                  </p>
                )}
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default AtivosMovimentacaoPanel;
