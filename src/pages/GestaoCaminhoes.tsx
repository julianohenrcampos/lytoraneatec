
import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import VeiculoPage from "@/components/veiculos/VeiculoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoCaminhoes: React.FC = () => {
  usePageTitle("Veículos e Equipamentos");
  const [searchParams] = useSearchParams();
  const situacaoFilter = searchParams.get('situacao');

  // Storage já configurado via migration

  return (
    <MainLayout>
      <VeiculoPage initialSituacaoFilter={situacaoFilter} />
    </MainLayout>
  );
};

export default GestaoCaminhoes;
