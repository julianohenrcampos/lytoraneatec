
import React from "react";
import { Card } from "@/components/ui/card";
import { Truck, Activity, Settings, AlertTriangle, Wrench, Clock } from "lucide-react";
import { MaquinasKpis } from "@/types/maquinas";

interface MaquinasKpiCardsProps {
  kpis: MaquinasKpis;
  isLoading: boolean;
}

export default function MaquinasKpiCards({ kpis, isLoading }: MaquinasKpiCardsProps) {
  const kpiItems = [
    {
      title: "Total de Ativos",
      value: kpis.totalAtivos,
      icon: Truck,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Operando Agora",
      value: kpis.ativosOperando,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Disponíveis",
      value: kpis.ativosDisponiveis,
      icon: Settings,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50"
    },
    {
      title: "Em Manutenção",
      value: kpis.ativosManutencao,
      icon: Wrench,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Chamados Abertos",
      value: kpis.chamadosAbertos,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      title: "Tempo Médio Reparo",
      value: `${kpis.tempoMedioReparo} dias`,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiItems.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <Card key={index} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                <IconComponent className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1 truncate">
                  {item.title}
                </p>
                <p className="text-lg font-bold">
                  {isLoading ? "..." : item.value}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
