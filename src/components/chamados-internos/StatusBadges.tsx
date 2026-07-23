/**
 * Badges reutilizáveis para status, prioridade e setor de Chamados Internos.
 * Fonte única para nomenclatura oficial.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CHAMADO_INTERNO_STATUS_META,
  CHAMADO_INTERNO_PRIORIDADE_META,
  CHAMADO_INTERNO_SETOR_META,
} from "@/constants/chamadosInternos";
import type {
  ChamadoInternoStatus,
  ChamadoInternoPrioridade,
  ChamadoInternoSetor,
} from "@/types/chamadosInternos";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold";

export const StatusBadge: React.FC<{ status: ChamadoInternoStatus; className?: string }> = ({
  status,
  className,
}) => {
  const meta = CHAMADO_INTERNO_STATUS_META[status];
  return (
    <span className={cn(base, meta.badgeClasses, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {meta.label}
    </span>
  );
};

export const PrioridadeBadge: React.FC<{
  prioridade: ChamadoInternoPrioridade;
  className?: string;
}> = ({ prioridade, className }) => {
  const meta = CHAMADO_INTERNO_PRIORIDADE_META[prioridade];
  return <span className={cn(base, meta.badgeClasses, className)}>{meta.label}</span>;
};

export const SetorBadge: React.FC<{ setor: ChamadoInternoSetor; className?: string }> = ({
  setor,
  className,
}) => {
  const meta = CHAMADO_INTERNO_SETOR_META[setor];
  return <span className={cn(base, meta.badgeClasses, className)}>{meta.label}</span>;
};

export function formatarProtocolo(p: string | null | undefined): string {
  return (p ?? "—").toString();
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatarPrazoRestante(iso: string | null | undefined): string {
  if (!iso) return "sem SLA";
  const alvo = new Date(iso).getTime();
  if (Number.isNaN(alvo)) return "sem SLA";
  const diff = alvo - Date.now();
  if (diff <= 0) return "vencido";
  const h = Math.floor(diff / 3600_000);
  if (h < 1) {
    const m = Math.max(1, Math.floor(diff / 60_000));
    return `${m}min restantes`;
  }
  if (h < 48) return `${h}h restantes`;
  const d = Math.floor(h / 24);
  return `${d}d restantes`;
}
