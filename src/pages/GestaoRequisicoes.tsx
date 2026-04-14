
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import RequisicaoPage from "@/components/requisicoes/RequisicaoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoRequisicoes: React.FC = () => {
  usePageTitle("Cadastro de Requisições");
  return (
    <MainLayout>
      <RequisicaoPage />
    </MainLayout>
  );
};

export default GestaoRequisicoes;
