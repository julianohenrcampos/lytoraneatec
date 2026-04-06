import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SolicitacaoTransporte } from "@/services/centralTransporteService";
import { SolicitacaoItem, STATUS_ITEM_LABELS, StatusItem, REGIME_LABELS, RegimeTrabalho } from "@/services/solicitacaoItensService";
import { AlertTriangle, Package } from "lucide-react";

const prioridadeBadge = (p: string) => {
  const map: Record<string, string> = {
    URGENTE: "bg-destructive text-destructive-foreground",
    ALTA: "bg-orange-500 text-white",
    NORMAL: "bg-secondary text-secondary-foreground",
  };
  return <Badge className={map[p] || ""}>{p}</Badge>;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    APROVADO: "bg-green-600 text-white",
    EM_TRANSPORTE: "bg-blue-600 text-white",
  };
  return <Badge className={map[s] || ""}>{s.replace(/_/g, " ")}</Badge>;
};

const statusItemBadge = (s: StatusItem) => {
  const map: Record<string, string> = {
    PENDENTE: "bg-amber-100 text-amber-800",
    EM_ANALISE: "bg-blue-100 text-blue-800",
    PLANEJADO: "bg-indigo-100 text-indigo-800",
    EM_COTACAO: "bg-purple-100 text-purple-800",
    ATENDIDO: "bg-green-100 text-green-800",
  };
  return <Badge className={map[s] || ""} variant="outline">{STATUS_ITEM_LABELS[s] || s}</Badge>;
};

const buildItemLabel = (item: SolicitacaoItem): string => {
  if (item.item_nao_catalogado) {
    return item.descricao_livre || "Não catalogado";
  }
  // Use subcategoria + capacidade if available
  if (item.subcategoria_nome) {
    const parts = [item.subcategoria_nome];
    if (item.capacidade_valor != null) {
      parts.push(`${item.capacidade_valor}${item.capacidade_unidade ? ` ${item.capacidade_unidade}` : ""}`);
    }
    return parts.join(" — ");
  }
  // Fallback to catalogo
  return item.catalogo_descricao || "Catálogo";
};

export interface SolicitacaoTransporteComItens extends SolicitacaoTransporte {
  itens?: SolicitacaoItem[];
}

interface Props {
  data: SolicitacaoTransporteComItens[];
  onSelect: (s: SolicitacaoTransporteComItens, item?: SolicitacaoItem) => void;
}

const CentralTransporteTable: React.FC<Props> = ({ data, onSelect }) => {
  return (
    <div className="rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Protocolo</TableHead>
            <TableHead>Centro de Custo</TableHead>
            <TableHead>Engenheiro</TableHead>
            <TableHead>Apontador</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Qtd</TableHead>
            <TableHead>Regime</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status Fluxo</TableHead>
            <TableHead>Status Item</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 && (
            <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma solicitação aprovada pendente.</TableCell></TableRow>
          )}
          {data.map((s) => {
            const itens = s.itens && s.itens.length > 0 ? s.itens : null;

            if (!itens) {
              return (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(s)}>
                  <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}</TableCell>
                  <TableCell>{s.nome_centro_custo || "—"}</TableCell>
                  <TableCell>{s.engenheiro_nome || "—"}</TableCell>
                  <TableCell>{s.apontador_nome || "—"}</TableCell>
                  <TableCell>{s.descricao_tipo_equipamento || "—"}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>{s.quantidade}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>{prioridadeBadge(s.prioridade)}</TableCell>
                  <TableCell>{statusBadge(s.status_fluxo)}</TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              );
            }

            return itens.map((item, idx) => (
              <TableRow
                key={`${s.id}-${item.id}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(s, item)}
              >
                <TableCell className="font-mono text-xs">{idx === 0 ? s.id.slice(0, 8) : ""}</TableCell>
                <TableCell>{idx === 0 ? (s.nome_centro_custo || "—") : ""}</TableCell>
                <TableCell>{idx === 0 ? (s.engenheiro_nome || "—") : ""}</TableCell>
                <TableCell>{idx === 0 ? (s.apontador_nome || "—") : ""}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.item_nao_catalogado ? (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                        <span className="truncate">{buildItemLabel(item)}</span>
                      </>
                    ) : (
                      <>
                        <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{buildItemLabel(item)}</span>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{item.tipo_item}</Badge>
                </TableCell>
                <TableCell>{item.quantidade}</TableCell>
                <TableCell className="text-xs">
                  {item.regime_trabalho ? (REGIME_LABELS[item.regime_trabalho as RegimeTrabalho] || item.regime_trabalho) : "—"}
                </TableCell>
                <TableCell>{idx === 0 ? prioridadeBadge(s.prioridade) : null}</TableCell>
                <TableCell>{idx === 0 ? statusBadge(s.status_fluxo) : null}</TableCell>
                <TableCell>{statusItemBadge(item.status_item)}</TableCell>
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default CentralTransporteTable;
