import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import SolicitacaoEquipamentoPage from "@/components/solicitacoes-equipamento/SolicitacaoEquipamentoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoSolicitacoesEquipamento: React.FC = () => {
  usePageTitle("Solicitações de Equipamento");
  return (
    <MainLayout>
      <SolicitacaoEquipamentoPage />
    </MainLayout>
  );
};

export default GestaoSolicitacoesEquipamento;
