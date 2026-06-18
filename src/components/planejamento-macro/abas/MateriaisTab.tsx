import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import TabIntro from "../shared/TabIntro";
import { Package } from "lucide-react";

const MateriaisTab: React.FC = () => {
  return (
    <Card>
      <CardContent className="pt-6">
        <TabIntro text="Materiais previstos no cronograma com unidades e quantidades agregadas." />
        <TabHeader
          title="Materiais Planejados"
          description="Insumos planejados para o cronograma da versão vigente."
        />
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Materiais planejados — fase futura"
          description="Materiais planejados serão tratados em fase futura."
        />
      </CardContent>
    </Card>
  );
};

export default MateriaisTab;
