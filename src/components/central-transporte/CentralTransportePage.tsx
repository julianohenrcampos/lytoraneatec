import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchSolicitacoesTransporte, SolicitacaoTransporte } from "@/services/centralTransporteService";
import { SolicitacaoItem } from "@/services/solicitacaoItensService";
import CentralTransporteFilters from "./CentralTransporteFilters";
import CentralTransporteTable, { SolicitacaoTransporteComItens } from "./CentralTransporteTable";
import AnaliseOperacionalSheet from "./AnaliseOperacionalSheet";
import { emitNotification } from "@/services/notifications/notificationEmitter";
import { getDestinatariosStatusCentral } from "@/services/notifications/recipientsService";
import { formatProtocolo } from "@/utils/formatProtocolo";
import { useAuth } from "@/hooks/useAuth";
import useCtOperation from "@/hooks/central-transporte/useCtOperation";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export type SelectedContext = {
  solicitacao: SolicitacaoTransporteComItens;
  item: SolicitacaoItem | null;
};

export type CentralTransporteFilterState = {
  centro_custo_id?: string;
  departamento_id?: string;
  prioridade?: string;
  tipo_equipamento_id?: string;
  status_fluxo?: string;
};

const CentralTransportePage: React.FC = () => {
  const [filters, setFilters] = useState<CentralTransporteFilterState>({});
  const [selected, setSelected] = useState<SelectedContext | null>(null);
  const { userId } = useAuth();

  // Motor de idempotência: vive aqui (componente persistente) para que o
  // request_id sobreviva ao fechamento do modal e à reabertura da solicitação.
  const ctOperation = useCtOperation();
  const capabilities = useCentralTransporteCapabilities();

  const temTentativaIncerta = Array.from(ctOperation.attempts.values()).some(
    (a) => a.state === "UNCERTAIN",
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["central-transporte", filters],
    queryFn: () => fetchSolicitacoesTransporte(filters),
  });

  const handleSelect = (s: SolicitacaoTransporteComItens, item?: SolicitacaoItem) => {
    setSelected({ solicitacao: s, item: item ?? null });
  };

  return (
    <div className="space-y-4">
      {temTentativaIncerta && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Existe uma operação da Central do Transporte sem confirmação. Reabra a solicitação
            correspondente e repita a mesma operação — a chave de idempotência foi preservada e o
            registro não será duplicado.
          </AlertDescription>
        </Alert>
      )}

      <CentralTransporteFilters filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <CentralTransporteTable data={data || []} onSelect={handleSelect} />
      )}

      <AnaliseOperacionalSheet
        context={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        ctOperation={ctOperation}
        capabilities={capabilities}

        onDecisaoSaved={() => {
          const solicitacaoSelecionada = selected?.solicitacao as (SolicitacaoTransporte & {
            solicitante_id?: string | null;
            engenheiro_solicitante_id?: string | null;
            apontador_responsavel_id?: string | null;
          }) | undefined;

          refetch();
          // A análise permanece aberta: o operador pode registrar outros
          // atendimentos do mesmo item sem reabrir a solicitação.


          void (async () => {
            try {
              if (!solicitacaoSelecionada) return;

              const destinatariosBase = getDestinatariosStatusCentral({
                solicitante_id: solicitacaoSelecionada.solicitante_id ?? null,
                engenheiro_solicitante_id: solicitacaoSelecionada.engenheiro_solicitante_id ?? null,
                apontador_responsavel_id: solicitacaoSelecionada.apontador_responsavel_id ?? null,
              });

              const destinatarios = destinatariosBase.filter((id) => id !== userId);
              if (destinatarios.length === 0) return;

              const protocolo = formatProtocolo(solicitacaoSelecionada.id);

              await emitNotification({
                tipo: "equip_central_status",
                titulo: "Atualização da Central do Transporte",
                mensagem: `Solicitação ${protocolo} teve uma decisão registrada pela Central do Transporte.`,
                link: "/gestao-maquinas/solicitacoes-equipamentos",
                metadata: {
                  solicitacao_id: solicitacaoSelecionada.id,
                  protocolo,
                  status_fluxo: "EM_TRANSPORTE",
                },
                destinatariosUserIds: destinatarios,
              });
            } catch (e) {
              console.warn("[CENTRAL_TRANSPORTE][NOTIF_STATUS_ERROR]", e);
            }
          })();
        }}
      />
    </div>
  );
};

export default CentralTransportePage;
