import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import DisponibilidadePage from "@/components/disponibilidade/DisponibilidadePage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoDisponibilidade: React.FC = () => {
  usePageTitle("Disponibilidade Operacional");
  return (
    <MainLayout>
      <DisponibilidadePage />
    </MainLayout>
  );
};

export default GestaoDisponibilidade;
