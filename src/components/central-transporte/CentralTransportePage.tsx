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

const CentralTransportePage: React.FC = () => {
  const [filters, setFilters] = useState<any>({});
  const [selected, setSelected] = useState<SolicitacaoTransporte | null>(null);
  const { userId } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["central-transporte", filters],
    queryFn: () => fetchSolicitacoesTransporte(filters),
  });

  const handleSelect = (s: SolicitacaoTransporteComItens, _item?: SolicitacaoItem) => {
    setSelected(s);
  };

  return (
    <div className="space-y-4">



      <CentralTransporteFilters filters={filters} onChange={setFilters} />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <CentralTransporteTable data={data || []} onSelect={handleSelect} />
      )}

      <AnaliseOperacionalSheet
        solicitacao={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onDecisaoSaved={() => {
          const solicitacaoSelecionada = selected as (SolicitacaoTransporte & {
            solicitante_id?: string | null;
            engenheiro_solicitante_id?: string | null;
            apontador_responsavel_id?: string | null;
          }) | null;

          refetch();
          setSelected(null);

          void (async () => {
            try {
              if (!solicitacaoSelecionada) return;

              const destinatariosBase = getDestinatariosStatusCentral({
                solicitante_id: solicitacaoSelecionada.solicitante_id ?? null,
                engenheiro_solicitante_id: solicitacaoSelecionada.engenheiro_solicitante_id ?? null,
                apontador_responsavel_id: solicitacaoSelecionada.apontador_responsavel_id ?? null,
              });

              const destinatarios = destinatariosBase.filter((id) => id !== userId);

              if (destinatarios.length === 0) {
                console.warn("[CENTRAL_TRANSPORTE][NOTIF_STATUS_SKIP] sem destinatários", {
                  solicitacao_id: solicitacaoSelecionada.id,
                });
                return;
              }

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
