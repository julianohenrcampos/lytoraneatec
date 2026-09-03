import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import CentralTransporteSolicitacaoPage from "@/components/central-transporte/solicitacao/CentralTransporteSolicitacaoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const CentralTransporteSolicitacao: React.FC = () => {
  usePageTitle("Solicitação — Central do Transporte");
  return (
    <MainLayout>
      <CentralTransporteSolicitacaoPage />
    </MainLayout>
  );
};

export default CentralTransporteSolicitacao;
