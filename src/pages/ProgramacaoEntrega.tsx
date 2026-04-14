
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import ProgramacaoEntregaPage from "@/components/programacao/ProgramacaoEntregaPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const ProgramacaoEntrega: React.FC = () => {
  usePageTitle("Programação de Entrega");
  return (
    <MainLayout>
      <ProgramacaoEntregaPage />
    </MainLayout>
  );
};

export default ProgramacaoEntrega;
