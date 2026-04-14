import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import DiretoriaPage from "@/components/diretorias/DiretoriaPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoDiretorias = () => {
  usePageTitle("Gestão de Diretorias");
  return (
    <MainLayout>
      <DiretoriaPage />
    </MainLayout>
  );
};

export default GestaoDiretorias;
