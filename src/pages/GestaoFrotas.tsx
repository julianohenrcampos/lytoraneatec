import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import FrotaPage from "@/components/frotas/FrotaPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoFrotas: React.FC = () => {
  usePageTitle("Gestão de Frotas");
  return (
    <MainLayout>
      <FrotaPage />
    </MainLayout>
  );
};

export default GestaoFrotas;
