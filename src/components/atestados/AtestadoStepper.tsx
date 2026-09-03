import { cn } from "@/lib/utils";

interface Props {
  current: 1 | 2 | 3 | 4;
}

const steps = [
  { n: 1, label: "Orientações" },
  { n: 2, label: "Validação" },
  { n: 3, label: "Envio" },
  { n: 4, label: "Protocolo" },
];

export default function AtestadoStepper({ current }: Props) {
  return (
    <ol className="flex items-center justify-between mb-6 gap-2">
      {steps.map((s, i) => {
        const active = s.n === current;
        const done = s.n < current;
        return (
          <li key={s.n} className="flex-1 flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border",
                done && "bg-primary text-primary-foreground border-primary",
                active && "bg-primary/10 text-primary border-primary",
                !done && !active && "bg-muted text-muted-foreground border-border"
              )}
            >
              {s.n}
            </div>
            <span
              className={cn(
                "text-xs truncate",
                active ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-border mx-1 hidden sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
