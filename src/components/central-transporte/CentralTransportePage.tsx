import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { fetchSolicitacoesTransporte, SolicitacaoTransporte } from "@/services/centralTransporteService";
import { SolicitacaoItem } from "@/services/solicitacaoItensService";
import CentralTransporteFilters from "./CentralTransporteFilters";
import CentralTransporteTable, { SolicitacaoTransporteComItens } from "./CentralTransporteTable";
import AnaliseOperacionalSheet from "./AnaliseOperacionalSheet";

const CentralTransportePage: React.FC = () => {
  const [filters, setFilters] = useState<any>({});
  const [selected, setSelected] = useState<SolicitacaoTransporte | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["central-transporte", filters],
    queryFn: () => fetchSolicitacoesTransporte(filters),
  });

  const handleSelect = (s: SolicitacaoTransporteComItens, _item?: SolicitacaoItem) => {
    setSelected(s);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Central do Transporte</h1>
      </div>

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
          refetch();
          setSelected(null);
        }}
      />
    </div>
  );
};

export default CentralTransportePage;
