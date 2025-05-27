
import React, { useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import VeiculoPage from "@/components/veiculos/VeiculoPage";
import { setupVeiculosStorage } from "@/integrations/supabase/setupStorage";

const GestaoCaminhoes: React.FC = () => {
  // Initialize storage when the component mounts
  useEffect(() => {
    setupVeiculosStorage().catch(error => {
      console.error("Failed to setup storage for vehicles:", error);
    });
  }, []);

  return (
    <MainLayout>
      <VeiculoPage />
    </MainLayout>
  );
};

export default GestaoCaminhoes;
