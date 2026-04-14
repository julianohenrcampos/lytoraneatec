import React from "react";
import { useParams } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import ChecklistSaidaForm from "@/components/movimentacoes/ChecklistSaidaForm";
import { usePageTitle } from "@/contexts/PageTitleContext";

const ChecklistSaida: React.FC = () => {
  usePageTitle("Checklist de Saída");
  const { movimentacaoId } = useParams<{ movimentacaoId: string }>();

  if (!movimentacaoId) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">ID da movimentação não informado.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ChecklistSaidaForm movimentacaoId={movimentacaoId} />
    </MainLayout>
  );
};

export default ChecklistSaida;
