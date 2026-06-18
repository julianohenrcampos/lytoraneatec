import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import TabIntro from "../shared/TabIntro";
import { CalendarDays } from "lucide-react";

const OrdemDiariaTab: React.FC = () => {
  return (
    <Card>
      <CardContent className="pt-6">
        <TabIntro text="Ordem Diária será habilitada após a validação do Planejamento Semanal e dos recursos planejados." />
        <TabHeader
          title="Ordem Diária — Fase futura"
          description="A Ordem Diária consolidará a programação do dia a partir do Planejamento Semanal validado."
        />
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Ordem Diária — Fase futura"
          description="Ordem Diária será habilitada após a validação do Planejamento Semanal e dos recursos planejados."
        />
      </CardContent>
    </Card>
  );
};

export default OrdemDiariaTab;
