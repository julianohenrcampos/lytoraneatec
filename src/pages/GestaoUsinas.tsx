
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import UsinaPage from "@/components/usinas/UsinaPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoUsinas: React.FC = () => {
  usePageTitle("Cadastro de Usinas");
  return (
    <MainLayout>
      <UsinaPage />
    </MainLayout>
  );
};

export default GestaoUsinas;
