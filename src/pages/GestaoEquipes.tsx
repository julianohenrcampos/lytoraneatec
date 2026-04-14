
import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import EquipePage from '@/components/equipes/EquipePage';
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoEquipes: React.FC = () => {
  usePageTitle("Cadastro de Equipes");
  return (
    <MainLayout>
      <EquipePage />
    </MainLayout>
  );
};

export default GestaoEquipes;
