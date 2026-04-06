import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import CentralTransportePage from "@/components/central-transporte/CentralTransportePage";

const CentralTransporte: React.FC = () => {
  return (
    <MainLayout>
      <CentralTransportePage />
    </MainLayout>
  );
};

export default CentralTransporte;
