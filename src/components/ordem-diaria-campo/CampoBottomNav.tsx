import React from "react";
import { Home, ListChecks, Users, ClipboardList } from "lucide-react";
import type { CampoTabId } from "@/types/ordemDiariaCampo";

interface Props {
  active: CampoTabId;
  onChange: (t: CampoTabId) => void;
}

const TABS: Array<{ id: CampoTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "hoje", label: "Hoje", icon: Home },
  { id: "tarefas", label: "Tarefas", icon: ListChecks },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "diario", label: "Diário", icon: ClipboardList },
];

export const CampoBottomNav: React.FC<Props> = ({ active, onChange }) => {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border md:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                className={
                  "w-full flex flex-col items-center gap-1 py-2 text-[11px] transition-colors " +
                  (isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
