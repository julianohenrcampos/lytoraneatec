import React from "react";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  vigente: "Vigente",
  arquivado: "Arquivado",
  cancelado: "Cancelado",
  cancelada: "Cancelada",
};

type Variant = "default" | "secondary" | "outline" | "destructive";

const STATUS_VARIANT: Record<string, Variant> = {
  rascunho: "secondary",
  vigente: "default",
  arquivado: "outline",
  cancelado: "destructive",
  cancelada: "destructive",
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const label = STATUS_LABEL[status] ?? status;
  const variant = STATUS_VARIANT[status] ?? "outline";
  return <Badge variant={variant}>{label}</Badge>;
};
