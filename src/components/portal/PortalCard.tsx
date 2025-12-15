import { LucideIcon, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PortalCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  color: string;
  hasPermission: boolean;
}

export function PortalCard({
  title,
  description,
  icon: Icon,
  route,
  color,
  hasPermission,
}: PortalCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (hasPermission) {
      navigate(route);
    } else {
      toast.error("Você não tem permissão para acessar este módulo");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 min-h-[180px] w-full text-left",
        hasPermission
          ? "hover:scale-105 hover:shadow-xl cursor-pointer border-transparent"
          : "cursor-not-allowed opacity-50 grayscale border-border/50"
      )}
      style={{
        backgroundColor: hasPermission ? color : undefined,
      }}
      disabled={!hasPermission}
    >
      {/* Lock icon for disabled cards */}
      {!hasPermission && (
        <div className="absolute top-3 right-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      {/* Icon */}
      <div
        className={cn(
          "mb-4 p-4 rounded-xl",
          hasPermission ? "bg-white/20" : "bg-muted"
        )}
      >
        <Icon
          className={cn(
            "h-10 w-10",
            hasPermission ? "text-white" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Title */}
      <h3
        className={cn(
          "text-lg font-semibold text-center",
          hasPermission ? "text-white" : "text-muted-foreground"
        )}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={cn(
          "text-sm text-center mt-1",
          hasPermission ? "text-white/80" : "text-muted-foreground/70"
        )}
      >
        {description}
      </p>
    </button>
  );
}
