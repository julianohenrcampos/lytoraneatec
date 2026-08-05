import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PopsBibliotecaPage from '@/components/pops/PopsBibliotecaPage';
import { usePageTitle } from '@/contexts/PageTitleContext';

const BibliotecaPops: React.FC = () => {
  usePageTitle('Biblioteca de POPs');
  return (
    <MainLayout>
      <PopsBibliotecaPage />
    </MainLayout>
  );
};

export default BibliotecaPops;
