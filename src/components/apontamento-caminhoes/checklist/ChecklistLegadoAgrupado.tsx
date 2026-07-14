import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import type { ChecklistValor } from "@/services/apontamentoCaminhoesService";
import {
  LEGADO_GRUPOS,
  LEGADO_TOTAL_ITENS,
  type LegadoChecklistKey,
} from "./checklistLegadoGroups";
import { resolverGrupoVisual } from "./checklistGroupVisuals";

export type LegadoChecklistValues = Partial<
  Record<LegadoChecklistKey, ChecklistValor | "">
>;

/** CREATE legado: inicializa os 10 campos como "OK" (Conforme). */
export function novoEstadoLegadoOK(): LegadoChecklistValues {
  const v: LegadoChecklistValues = {};
  LEGADO_GRUPOS.forEach((g) =>
    g.itens.forEach((i) => {
      v[i.codigo] = "OK";
    })
  );
  return v;
}

interface Props {
  values: LegadoChecklistValues;
  onChange: (key: LegadoChecklistKey, valor: ChecklistValor) => void;
  showValidation?: boolean;
  showInitialHint?: boolean;
  disabled?: boolean;
}

const STATUS_STYLES: Record<ChecklistValor, string> = {
  OK: "border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
  NAO_OK: "border-red-500 text-red-700 bg-red-50 hover:bg-red-100",
  NA: "border-orange-500 text-orange-700 bg-orange-50 hover:bg-orange-100",
};

const ChecklistLegadoAgrupado: React.FC<Props> = ({
  values,
  onChange,
  showValidation,
  showInitialHint,
  disabled,
}) => {
  const [abertos, setAbertos] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    LEGADO_GRUPOS.forEach((g, idx) => (m[g.codigo] = idx === 0));
    return m;
  });

  const stats = useMemo(() => {
    let resp = 0;
    let nao = 0;
    LEGADO_GRUPOS.forEach((g) =>
      g.itens.forEach((i) => {
        const v = values[i.codigo];
        if (v === "OK" || v === "NAO_OK" || v === "NA") {
          resp++;
          if (v === "NAO_OK") nao++;
        }
      })
    );
    return { resp, nao, total: LEGADO_TOTAL_ITENS };
  }, [values]);

  const completo = stats.resp >= stats.total;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm px-3 py-2 bg-muted/40 border rounded-md">
          <Badge
            variant={completo ? "secondary" : "outline"}
            className={
              completo
                ? "rounded-full bg-emerald-100 text-emerald-800"
                : "rounded-full"
            }
          >
            {stats.resp}/{stats.total} respondidos
          </Badge>
          {stats.nao > 0 && (
            <Badge className="rounded-full bg-red-100 text-red-800 hover:bg-red-100">
              {stats.nao} não conforme{stats.nao > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {showInitialHint && completo && stats.nao === 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs sm:text-sm">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Todos os itens iniciam como Conforme. Revise e altere as exceções.</span>
          </div>
        )}
      </div>

      {LEGADO_GRUPOS.map((g) => {
        const visual = resolverGrupoVisual(g.icone || g.titulo);
        const Icon = visual.icon;
        const total = g.itens.length;
        const resp = g.itens.filter((i) => {
          const v = values[i.codigo];
          return v === "OK" || v === "NAO_OK" || v === "NA";
        }).length;
        const naoConf = g.itens.filter((i) => values[i.codigo] === "NAO_OK").length;
        const aberto = !!abertos[g.codigo];

        return (
          <div
            key={g.codigo}
            className={cn(
              "rounded-lg shadow-sm bg-card overflow-hidden",
              visual.borderClassName
            )}
          >
            <button
              type="button"
              onClick={() =>
                setAbertos((p) => ({ ...p, [g.codigo]: !p[g.codigo] }))
              }
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors",
                visual.headerClassName
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn("shrink-0", visual.iconContainerClassName)}>
                  <Icon className={cn("h-4 w-4", visual.iconClassName)} />
                </span>
                <span className="font-semibold uppercase text-sm tracking-wide truncate">
                  {g.titulo}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] rounded-full bg-muted text-foreground/80"
                >
                  {resp}/{total}
                </Badge>
                {naoConf > 0 && (
                  <Badge className="text-[10px] rounded-full bg-red-100 text-red-800 hover:bg-red-100">
                    {naoConf} não conforme{naoConf > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  aberto && "rotate-180"
                )}
              />
            </button>
            {aberto && (
              <div className="p-3 space-y-3 border-t bg-background">
                {g.itens.map((i) => {
                  const v = values[i.codigo];
                  const status = v === "OK" || v === "NAO_OK" || v === "NA" ? v : undefined;
                  const invalido = showValidation && !status;
                  return (
                    <div
                      key={i.codigo}
                      className={cn(
                        "border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-h-[56px]",
                        invalido ? "border-red-400 bg-red-50/40" : "border-border"
                      )}
                    >
                      <div className="text-sm flex-1 min-w-0">
                        <span className="font-medium">{i.descricao}</span>
                        <span className="text-red-500 ml-1">*</span>
                      </div>
                      <div className="shrink-0 w-full sm:w-[180px]">
                        <Select
                          value={status ?? ""}
                          onValueChange={(val) =>
                            onChange(i.codigo, val as ChecklistValor)
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-9 text-sm font-medium border-2",
                              status ? STATUS_STYLES[status] : "border-muted-foreground/30"
                            )}
                          >
                            <SelectValue placeholder="Selecionar…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OK">
                              <span className="inline-flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Conforme
                              </span>
                            </SelectItem>
                            <SelectItem value="NAO_OK">
                              <span className="inline-flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Não conforme
                              </span>
                            </SelectItem>
                            <SelectItem value="NA">
                              <span className="inline-flex items-center gap-2">
                                <MinusCircle className="h-4 w-4 text-orange-500" />
                                Não aplicável
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChecklistLegadoAgrupado;
