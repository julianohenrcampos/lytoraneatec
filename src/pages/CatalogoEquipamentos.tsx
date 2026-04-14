import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import CatalogoPage from "@/components/catalogo/CatalogoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const CatalogoEquipamentos: React.FC = () => {
  usePageTitle("Catálogo Técnico de Equipamentos");
  return (
    <MainLayout>
      <CatalogoPage />
    </MainLayout>
  );
};

export default CatalogoEquipamentos;
