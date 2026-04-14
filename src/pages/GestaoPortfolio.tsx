import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import PortfolioPage from "@/components/portfolio/PortfolioPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoPortfolio: React.FC = () => {
  usePageTitle("Portfólio de Empresas / Veic. e Equip.");
  return (
    <MainLayout>
      <PortfolioPage />
    </MainLayout>
  );
};

export default GestaoPortfolio;
