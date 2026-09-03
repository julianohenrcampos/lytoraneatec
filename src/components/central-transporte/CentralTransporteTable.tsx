/**
 * CT-3B.1 — Central do Transporte: lista principal COMPACTA por protocolo.
 *
 * A lista é apenas um índice de solicitações: protocolo, obra, responsáveis,
 * período, prioridade, status e contagem de itens. Nenhuma descrição de item,
 * capacidade, regime ou status de item aparece aqui — o detalhamento vive na
 * etapa Itens da página dedicada. Nenhum contador de atendimento é consultado.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SolicitacaoTransporte } from "@/services/centralTransporteService";
import { SolicitacaoItem } from "@/services/solicitacaoItensService";
import { formatProtocolo } from "@/utils/formatProtocolo";
import { formatDateBR } from "@/utils/formatDateBR";
import { ChevronRight } from "lucide-react";

const prioridadeBadge = (p: string) => {
  const map: Record<string, string> = {
    URGENTE: "bg-destructive text-destructive-foreground",
    ALTA: "bg-orange-500 text-primary-foreground",
    NORMAL: "bg-secondary text-secondary-foreground",
  };
  return <Badge className={map[p] || ""}>{p}</Badge>;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    APROVADO: "bg-emerald-600 text-primary-foreground",
    EM_TRANSPORTE: "bg-blue-600 text-primary-foreground",
  };
  return <Badge className={map[s] || ""}>{s.replace(/_/g, " ")}</Badge>;
};

export const buildItemLabel = (item: SolicitacaoItem): string => {
  if (item.item_nao_catalogado) return item.descricao_livre || "Não catalogado";
  if (item.subcategoria_nome) {
    const parts = [item.subcategoria_nome];
    if (item.capacidade_valor != null) {
      parts.push(
        `${item.capacidade_valor}${item.capacidade_unidade ? ` ${item.capacidade_unidade}` : ""}`,
      );
    }
    return parts.join(" — ");
  }
  return item.catalogo_descricao || "Catálogo";
};

export interface SolicitacaoTransporteComItens extends SolicitacaoTransporte {
  itens?: SolicitacaoItem[];
}

interface Props {
  data: SolicitacaoTransporteComItens[];
  onSelect: (s: SolicitacaoTransporteComItens, item?: SolicitacaoItem) => void;
}

const MetaField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex min-w-0 flex-col">
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="truncate text-xs">{value}</span>
  </div>
);

const CentralTransporteTable: React.FC<Props> = ({ data, onSelect }) => {
  if (data.length === 0) {
    return (
      <div
        className="rounded-md border py-12 text-center text-sm text-muted-foreground"
        data-testid="ct-lista-vazia"
      >
        Nenhuma solicitação aprovada pendente.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="ct-lista-agrupada">
      {data.map((s) => {
        const itens = s.itens ?? [];
        const quantidadeTotal = itens.length
          ? itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0)
          : Number(s.quantidade) || 0;
        const periodo = [
          s.data_inicio ? formatDateBR(s.data_inicio) : null,
          s.data_fim ? formatDateBR(s.data_fim) : null,
        ]
          .filter(Boolean)
          .join(" a ");

        return (
          <Card
            key={s.id}
            role="button"
            tabIndex={0}
            data-testid={`ct-card-solicitacao-${s.id}`}
            className="cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => onSelect(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(s);
              }
            }}
          >
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                  {formatProtocolo(s.id)}
                </span>
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {s.nome_centro_custo || "Centro de Custo não informado"}
                </h3>
                {prioridadeBadge(s.prioridade)}
                {statusBadge(s.status_fluxo)}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  data-testid={`ct-abrir-solicitacao-${s.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(s);
                  }}
                >
                  Abrir solicitação <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetaField label="Engenheiro" value={s.engenheiro_nome || "—"} />
                <MetaField label="Apontador" value={s.apontador_nome || "—"} />
                <MetaField label="Departamento" value={s.departamento_nome || "—"} />
                <MetaField label="Período" value={periodo || "—"} />
                <MetaField
                  label="Itens"
                  value={itens.length ? String(itens.length) : "Modelo legado"}
                />
                <MetaField label="Qtd. solicitada" value={String(quantidadeTotal)} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default CentralTransporteTable;
