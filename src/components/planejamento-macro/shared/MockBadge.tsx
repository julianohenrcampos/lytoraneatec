import React from "react";
import { Badge } from "@/components/ui/badge";
import { Database, FlaskConical } from "lucide-react";

type Modo = "simulado" | "parcial";

interface Props {
  className?: string;
  modo?: Modo;
}

const MockBadge: React.FC<Props> = ({ className, modo = "simulado" }) => {
  if (modo === "parcial") {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-primary/40 text-primary ${className ?? ""}`}
      >
        <Database className="h-3 w-3" />
        Dados parcialmente reais — Atividades reais / demais dados simulados
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`gap-1 border-primary/40 text-primary ${className ?? ""}`}
    >
      <FlaskConical className="h-3 w-3" />
      Fase 1 — Visual / Dados simulados
    </Badge>
  );
};

export default MockBadge;
