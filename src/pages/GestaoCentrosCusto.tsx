
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import CentroCustoPage from "@/components/centrosCusto/CentroCustoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoCentrosCusto = () => {
  usePageTitle("Cadastro de Centros de Custo");
  return (
    <MainLayout>
      <CentroCustoPage />
    </MainLayout>
  );
};

export default GestaoCentrosCusto;
