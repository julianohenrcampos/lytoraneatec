import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatarPeriodoBR } from "@/components/planejamento-macro/shared/formatData";
import type { SemanaRef } from "@/lib/planejamentoMacro/planoSemanal/tipos";

interface Props {
  semana: SemanaRef;
  onAnterior: () => void;
  onProxima: () => void;
  onAtual: () => void;
}

const SeletorSemana: React.FC<Props> = ({ semana, onAnterior, onProxima, onAtual }) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="outline" size="icon" onClick={onAnterior} aria-label="Semana anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">
          Semana {String(semana.semana).padStart(2, "0")}/{semana.ano}
        </span>
        <span className="font-medium text-sm">
          {formatarPeriodoBR(semana.inicio, semana.fim)}
        </span>
      </div>
      <Button variant="outline" size="icon" onClick={onProxima} aria-label="Próxima semana">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={onAtual}>
        <CalendarDays className="h-4 w-4 mr-1" />
        Semana atual
      </Button>
    </div>
  );
};

export default SeletorSemana;
