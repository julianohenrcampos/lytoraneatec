import * as React from "react";
import { format, subMonths, startOfYear, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  value: DateRange | undefined;
  onChange: (range: DateRange) => void;
  className?: string;
}

type PresetKey = "30d" | "6m" | "12m" | "ano" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "30d", label: "Últimos 30 dias" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "12m", label: "Últimos 12 meses" },
  { key: "ano", label: "Ano atual" },
  { key: "custom", label: "Personalizado…" },
];

export function buildPresetRange(key: Exclude<PresetKey, "custom">): DateRange {
  const today = new Date();
  const to = today;
  let from: Date;
  switch (key) {
    case "30d": from = subMonths(today, 1); break;
    case "6m": from = subMonths(today, 6); break;
    case "12m": from = subMonths(today, 12); break;
    case "ano": from = startOfYear(today); break;
  }
  return { from: startOfDay(from), to };
}

function detectLabel(value?: DateRange): string {
  if (!value?.from) return "Selecionar período";
  if (value.to) {
    return `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(value.to, "dd/MM/yyyy", { locale: ptBR })}`;
  }
  return format(value.from, "dd/MM/yyyy", { locale: ptBR });
}

export function PeriodoRangePicker({ value, onChange, className }: Props) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"presets" | "custom">("presets");
  const [draft, setDraft] = React.useState<DateRange | undefined>(value);

  React.useEffect(() => {
    if (open) {
      setMode("presets");
      setDraft(value);
    }
  }, [open, value]);

  const handlePreset = (key: PresetKey) => {
    if (key === "custom") {
      setMode("custom");
      return;
    }
    onChange(buildPresetRange(key));
    setOpen(false);
  };

  const apply = () => {
    if (draft?.from && draft?.to) {
      onChange(draft);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 w-full justify-between font-normal text-xs", !value?.from && "text-muted-foreground", className)}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{detectLabel(value)}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2 z-[10000]">
        {mode === "presets" ? (
          <div className="flex flex-col gap-1 min-w-[200px]">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={draft?.from ?? subMonths(new Date(), 1)}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setMode("presets")}>Voltar</Button>
              <Button size="sm" onClick={apply} disabled={!draft?.from || !draft?.to}>
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
