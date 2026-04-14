
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import DepartamentoPage from "@/components/departamentos/DepartamentoPage";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoDepartamentos: React.FC = () => {
  usePageTitle("Cadastro de Departamentos");
  return (
    <MainLayout>
      <DepartamentoPage />
    </MainLayout>
  );
};

export default GestaoDepartamentos;
