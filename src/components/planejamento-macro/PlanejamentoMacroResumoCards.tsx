import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  Users,
  Truck,
  FileSearch,
  AlertTriangle,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { ResumoCard } from "./mockData";

interface Props {
  cards: ResumoCard[];
}

const ICONS: Record<string, LucideIcon> = {
  atividades: ClipboardList,
  mao_obra: Users,
  equipamentos: Truck,
  solicitacoes: FileSearch,
  impedimentos: AlertTriangle,
  producao: Activity,
};

const PlanejamentoMacroResumoCards: React.FC<Props> = ({ cards }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = ICONS[c.key] ?? ClipboardList;
        return (
          <Card key={c.key} className="hover:shadow-sm transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
                  {c.label}
                </p>
                <Icon className="h-4 w-4 text-primary shrink-0" />
              </div>
              <p className="text-2xl font-bold text-primary mt-2">{c.valor}</p>
              {c.hint && (
                <p className="text-[11px] text-muted-foreground mt-1">{c.hint}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PlanejamentoMacroResumoCards;
