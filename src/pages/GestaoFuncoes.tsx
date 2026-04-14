
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import FuncaoPage from "@/components/funcoes/FuncaoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoFuncoes: React.FC = () => {
  usePageTitle("Cadastro de Funções");
  return (
    <MainLayout>
      <FuncaoPage />
    </MainLayout>
  );
};

export default GestaoFuncoes;
