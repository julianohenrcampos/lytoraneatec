import React from "react";
import { Inbox } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<Props> = ({
  title = "Nenhum dado para exibir",
  description = "Selecione um centro de custo para visualizar as informações.",
  icon,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-muted-foreground">
    <div className="rounded-full bg-muted p-3 mb-3">
      {icon ?? <Inbox className="h-5 w-5" />}
    </div>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-xs mt-1 max-w-sm">{description}</p>
  </div>
);

export default EmptyState;
