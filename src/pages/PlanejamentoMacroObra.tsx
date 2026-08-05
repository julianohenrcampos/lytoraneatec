import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import PlanejamentoMacroPage from "@/components/planejamento-macro/PlanejamentoMacroPage";

// Fase 6F.2 — usePageTitle dinâmico é definido dentro de PlanejamentoMacroPage,
// para refletir o Centro de Custo selecionado.
const PlanejamentoMacroObra: React.FC = () => {
  return (
    <MainLayout>
      <PlanejamentoMacroPage />
    </MainLayout>
  );
};

export default PlanejamentoMacroObra;
