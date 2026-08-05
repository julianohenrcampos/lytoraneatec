import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  subtitle?: string | null;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

export const CampoHeader: React.FC<Props> = ({
  title,
  subtitle,
  showBack,
  onBack,
  right,
}) => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold truncate text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
};
