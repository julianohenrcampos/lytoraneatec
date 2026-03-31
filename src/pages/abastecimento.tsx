import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { usePageTitle } from "@/contexts/PageTitleContext";

const Abastecimento: React.FC = () => {
  usePageTitle("Gestão de Abastecimento");
  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">
          Página de abastecimento em desenvolvimento.
        </p>
      </div>
    </MainLayout>
  );
};

export default Abastecimento;