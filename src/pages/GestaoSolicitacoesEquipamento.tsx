import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import SolicitacaoEquipamentoPage from "@/components/solicitacoes-equipamento/SolicitacaoEquipamentoPage";

const GestaoSolicitacoesEquipamento: React.FC = () => {
  return (
    <MainLayout>
      <SolicitacaoEquipamentoPage />
    </MainLayout>
  );
};

export default GestaoSolicitacoesEquipamento;
