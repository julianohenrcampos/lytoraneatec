import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Map, Users, Wrench } from "lucide-react";

interface Props {
  totalAtividades: number;
  totalFrentes: number;
  totalFuncoes: number;
  picoEquipamentos: number;
}

const item = (
  label: string,
  value: number | string,
  Icon: React.ComponentType<{ className?: string }>
) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-tight">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const ResumoSemanaCards: React.FC<Props> = ({
  totalAtividades,
  totalFrentes,
  totalFuncoes,
  picoEquipamentos,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {item("Atividades na semana", totalAtividades, Activity)}
    {item("Frentes", totalFrentes, Map)}
    {item("Funções (MO)", totalFuncoes, Users)}
    {item("Equipamentos (pico)", picoEquipamentos, Wrench)}
  </div>
);

export default ResumoSemanaCards;
