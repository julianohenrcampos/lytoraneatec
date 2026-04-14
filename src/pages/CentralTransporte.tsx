import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import CentralTransportePage from "@/components/central-transporte/CentralTransportePage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const CentralTransporte: React.FC = () => {
  usePageTitle("Central do Transporte");
  return (
    <MainLayout>
      <CentralTransportePage />
    </MainLayout>
  );
};

export default CentralTransporte;
