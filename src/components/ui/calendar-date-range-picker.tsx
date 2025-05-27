
import * as React from "react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface CalendarDateRangePickerProps {
  date?: DateRange;
  onDateChange: (date: DateRange | undefined) => void;
}

export function CalendarDateRangePicker({ date, onDateChange }: CalendarDateRangePickerProps) {
  // Função de manipulação que preserva a data local correta, sem deslocamento de timezone
  const handleDateChange = (range: DateRange | undefined) => {
    if (!range) {
      onDateChange(undefined);
      return;
    }

    // Certifica-se de que as datas são preservadas como datas locais sem conversão UTC
    const normalizedRange: DateRange = {
      from: range.from ? new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 12, 0, 0) : undefined,
      to: range.to ? new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 12, 0, 0) : undefined
    };

    onDateChange(normalizedRange);
  };

  return (
    <div className="grid gap-2">
      <Calendar
        mode="range"
        selected={date}
        onSelect={handleDateChange}
        numberOfMonths={2}
        initialFocus
        className={cn("p-3 pointer-events-auto")}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDateChange(undefined)}
          className="pointer-events-auto"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </div>
    </div>
  );
}
