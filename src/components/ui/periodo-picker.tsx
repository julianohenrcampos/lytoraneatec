import * as React from "react";
import { format, subDays, startOfDay, isSameDay, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PeriodoPickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

type Preset = { label: string; days: number | "today" };

const PRESETS: Preset[] = [
  { label: "Hoje", days: "today" },
  { label: "Últimos 7 dias", days: 7 },
  { label: "Últimos 30 dias", days: 30 },
  { label: "Últimos 90 dias", days: 90 },
];

function buildRange(p: Preset): DateRange {
  const now = new Date();
  if (p.days === "today") return { from: startOfDay(now), to: now };
  return { from: subDays(now, p.days), to: now };
}

function detectLabel(value: DateRange | undefined, placeholder: string): string {
  if (!value?.from) return placeholder;
  const now = new Date();
  const to = value.to ?? value.from;

  if (isSameDay(value.from, startOfDay(now)) && isSameDay(to, now)) {
    if (isSameDay(value.from, now)) return "Hoje";
  }

  if (isSameDay(to, now) || differenceInCalendarDays(now, to) === 0) {
    const diff = differenceInCalendarDays(now, value.from);
    const match = [7, 30, 90].find((d) => Math.abs(diff - d) <= 0);
    if (match) return `Últimos ${match} dias`;
  }

  if (value.to) {
    return `${format(value.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(
      value.to,
      "dd/MM/yyyy",
      { locale: ptBR }
    )}`;
  }
  return format(value.from, "dd/MM/yyyy", { locale: ptBR });
}

export function PeriodoPicker({ value, onChange, placeholder = "Selecionar período", className }: PeriodoPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"presets" | "custom">("presets");
  const [draft, setDraft] = React.useState<DateRange | undefined>(value);

  React.useEffect(() => {
    if (open) {
      setMode("presets");
      setDraft(value);
    }
  }, [open, value]);

  const handlePreset = (p: Preset) => {
    onChange(buildRange(p));
    setOpen(false);
  };

  const handleApplyCustom = () => {
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
          className={cn(
            "h-10 w-full justify-between font-normal",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{detectLabel(value, placeholder)}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto min-w-[220px] p-2 z-[10000]"
      >
        {mode === "presets" ? (
          <div className="flex flex-col gap-1">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start font-normal"
                onClick={() => handlePreset(p)}
              >
                {p.label}
              </Button>
            ))}
            <div className="my-1 h-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start font-normal"
              onClick={() => setMode("custom")}
            >
              Personalizado…
            </Button>
            {value?.from && (
              <>
                <div className="my-1 h-px bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal text-muted-foreground"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  Limpar período
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-1 pb-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setMode("presets")}
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
              <span className="text-xs text-muted-foreground">Personalizado</span>
            </div>
            <Calendar
              mode="range"
              numberOfMonths={1}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={draft?.from ?? new Date()}
              locale={ptBR}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(undefined);
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={handleApplyCustom}
                disabled={!draft?.from || !draft?.to}
              >
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
