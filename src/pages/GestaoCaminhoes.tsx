
import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import VeiculoPage from "@/components/veiculos/VeiculoPage";
import { setupVeiculosStorage } from "@/integrations/supabase/setupStorage";

const GestaoCaminhoes: React.FC = () => {
  const [searchParams] = useSearchParams();
  const situacaoFilter = searchParams.get('situacao');

  // Initialize storage when the component mounts
  useEffect(() => {
    setupVeiculosStorage().catch(error => {
      console.error("Failed to setup storage for vehicles:", error);
    });
  }, []);

  return (
    <MainLayout>
      <VeiculoPage initialSituacaoFilter={situacaoFilter} />
    </MainLayout>
  );
};

export default GestaoCaminhoes;
