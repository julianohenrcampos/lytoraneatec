/**
 * CT-3B — Cabeçalho/resumo da solicitação (reutilizável).
 *
 * Todos os números de progresso vêm dos contadores da RPC (fn_ct_contadores_item)
 * agregados por soma; nada é inferido do frontend.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SolicitacaoTransporte } from "@/services/centralTransporteService";
import type { CtItemComAtendimentos } from "@/types/centralTransporteCT2";
import { formatProtocolo } from "@/utils/formatProtocolo";
import { formatDateBR } from "@/utils/formatDateBR";

interface Props {
  solicitacao: SolicitacaoTransporte;
  resumoItens: CtItemComAtendimentos[];
  totalItens: number;
}

const Metric: React.FC<{ label: string; value: React.ReactNode; testId?: string }> = ({
  label,
  value,
  testId,
}) => (
  <div className="flex flex-col min-w-0" data-testid={testId}>
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-sm font-medium truncate">{value}</span>
  </div>
);

export const SolicitacaoResumoHeader: React.FC<Props> = ({
  solicitacao,
  resumoItens,
  totalItens,
}) => {
  const soma = resumoItens.reduce(
    (acc, i) => ({
      solicitado: acc.solicitado + (i.quantidade ?? 0),
      reservado: acc.reservado + i.contadores.reservado,
      em_transporte: acc.em_transporte + i.contadores.em_transporte,
      entregue: acc.entregue + i.contadores.entregue,
      pendentes: acc.pendentes + i.contadores.pendentes,
    }),
    { solicitado: 0, reservado: 0, em_transporte: 0, entregue: 0, pendentes: 0 },
  );

  const periodo = [
    solicitacao.data_inicio ? formatDateBR(solicitacao.data_inicio) : null,
    solicitacao.data_fim ? formatDateBR(solicitacao.data_fim) : null,
  ]
    .filter(Boolean)
    .join(" a ");

  return (
    <Card data-testid="ct3b-resumo-header">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
            {formatProtocolo(solicitacao.id)}
          </span>
          <h2 className="text-base font-semibold truncate">
            {solicitacao.nome_centro_custo || "Centro de Custo não informado"}
          </h2>
          <Badge variant="outline" className="text-[10px]">
            {solicitacao.status_fluxo.replace(/_/g, " ")}
          </Badge>
          <Badge className="text-[10px]">{solicitacao.prioridade}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Metric label="Engenheiro" value={solicitacao.engenheiro_nome || "—"} />
          <Metric label="Apontador" value={solicitacao.apontador_nome || "—"} />
          <Metric label="Departamento" value={solicitacao.departamento_nome || "—"} />
          <Metric label="Período" value={periodo || "—"} />
          <Metric label="Itens" value={String(totalItens)} testId="ct3b-total-itens" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 border-t pt-3">
          <Metric label="Equipamentos solicitados" value={soma.solicitado} testId="ct3b-soma-solicitado" />
          <Metric label="Reservados" value={soma.reservado} testId="ct3b-soma-reservado" />
          <Metric label="Em transporte" value={soma.em_transporte} testId="ct3b-soma-transporte" />
          <Metric label="Entregues" value={soma.entregue} testId="ct3b-soma-entregue" />
          <Metric label="Pendentes" value={soma.pendentes} testId="ct3b-soma-pendentes" />
        </div>
      </CardContent>
    </Card>
  );
};

export default SolicitacaoResumoHeader;
