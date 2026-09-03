import React from 'react';
import MainLayout from '@/components/layout/MainLayout';
import PopsGestaoPage from '@/components/pops/PopsGestaoPage';
import { usePageTitle } from '@/contexts/PageTitleContext';

const GestaoPops: React.FC = () => {
  usePageTitle('Gestão de POPs');
  return (
    <MainLayout>
      <PopsGestaoPage />
    </MainLayout>
  );
};

export default GestaoPops;
