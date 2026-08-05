import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  hasCentroCusto: boolean;
  hasPlanejamentoVigente: boolean;
  totalPendencias: number;
}

const STORAGE_KEY = "planejamento-macro:stepper-oculto";

/**
 * Fase 7C — Stepper discreto/recolhível.
 * Apenas apresentação; nenhuma lógica de negócio nova.
 */
const FluxoStepper: React.FC<Props> = ({
  hasCentroCusto,
  hasPlanejamentoVigente,
  totalPendencias,
}) => {
  const [oculto, setOculto] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, oculto ? "1" : "0");
  }, [oculto]);

  let passoAtivo = 1;
  if (!hasCentroCusto) passoAtivo = 1;
  else if (!hasPlanejamentoVigente) passoAtivo = 2;
  else if (totalPendencias > 0) passoAtivo = 3;
  else passoAtivo = 4;

  const passos = [
    "Centro de Custo",
    "Importar cronograma",
    "Revisar pendências",
    "Planejamento Semanal",
    "Ordem Diária em breve",
  ];

  return (
    <div className="border rounded-md bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        {oculto ? (
          <span className="text-xs text-muted-foreground">
            Guia de fluxo recolhida
          </span>
        ) : (
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
            {passos.map((p, i) => {
              const idx = i + 1;
              const ativo = idx === passoAtivo;
              const concluido = idx < passoAtivo;
              return (
                <li key={p} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                      ativo && "bg-primary text-primary-foreground",
                      concluido && "bg-primary/20 text-primary",
                      !ativo && !concluido && "bg-muted text-muted-foreground"
                    )}
                  >
                    {idx}
                  </span>
                  <span
                    className={cn(
                      ativo && "text-foreground font-medium",
                      concluido && "text-foreground/70"
                    )}
                  >
                    {p}
                  </span>
                  {idx < passos.length && (
                    <span className="text-muted-foreground/60 px-1">→</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs shrink-0"
          onClick={() => setOculto((v) => !v)}
          aria-label={oculto ? "Mostrar guia" : "Ocultar guia"}
        >
          {oculto ? (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Mostrar guia
            </>
          ) : (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Ocultar guia
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default FluxoStepper;
