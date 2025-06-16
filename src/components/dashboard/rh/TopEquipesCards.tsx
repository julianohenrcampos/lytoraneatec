
import React from "react";
import { EquipeAnalise } from "@/hooks/dashboard/useRhDashboardData";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

interface TopEquipesCardsProps {
  equipes: EquipeAnalise[];
}

function getEquipeAvaliacaoCor(media: number | null | undefined) {
  if (media == null) return "text-muted-foreground";
  if (media >= 4.5) return "text-green-600";
  if (media >= 3.5) return "text-yellow-500";
  return "text-red-600";
}

const TopEquipesCards: React.FC<TopEquipesCardsProps> = ({ equipes }) => {
  return (
    <div className="flex flex-wrap gap-4 animate-fade-in">
      {equipes.map(eq => (
        <div
          key={eq.id}
          className="flex flex-col flex-1 min-w-[220px] max-w-[260px] bg-card rounded-lg shadow p-4 group border hover:scale-105 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{eq.nome_equipe}</div>
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className={getEquipeAvaliacaoCor(eq.mediaEquipe) + " text-lg font-bold"}>
              {eq.mediaEquipe != null ? Number(eq.mediaEquipe).toFixed(1) : "--"}
            </span>
            <span className="text-xs text-muted-foreground">Média Avaliação</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary">👥 {eq.qtdColaboradores ?? "--"}</Badge>
            <span className="text-xs text-muted-foreground">colaboradores</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopEquipesCards;
