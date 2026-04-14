import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import CatalogoSugestoesPage from "@/components/catalogo/CatalogoSugestoesPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const CatalogoSugestoes = () => {
  usePageTitle("Sugestões de Catálogo");
  return (
    <MainLayout>
      <CatalogoSugestoesPage />
    </MainLayout>
  );
};

export default CatalogoSugestoes;
