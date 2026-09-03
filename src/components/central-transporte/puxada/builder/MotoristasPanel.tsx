/**
 * CT-5 Builder — Rail direita: MOTORISTAS arrastáveis.
 *
 * Fonte: `fn_motoristas_operacional_lookup` (RPC SECURITY DEFINER — vale também
 * para o papel Apontador), via `useCtMotoristasOperacionais`. Nenhuma
 * disponibilidade é inventada: o tom reflete apenas uso NESTE rascunho.
 */
import React, { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle, GripVertical, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { puxDragId } from "@/lib/central-transporte/puxadaBuilder";
import type { CtMotoristaOperacional } from "@/types/centralTransportePuxada";

interface ItemProps {
  motorista: CtMotoristaOperacional;
  emUso: boolean;
  desabilitado: boolean;
  /** Fallback por clique: aplicar a um caminhão do canvas. */
  destinos: { chaveLocal: string; rotulo: string }[];
  onAplicar: (chaveLocal: string) => void;
}

const MotoristaItem: React.FC<ItemProps> = ({
  motorista,
  emUso,
  desabilitado,
  destinos,
  onAplicar,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: puxDragId("PUX_MOTORISTA", motorista.id),
    disabled: desabilitado,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct5-motorista-${motorista.id}`}
      data-em-uso={emUso ? "true" : "false"}
      title={`${motorista.nomeCompleto}${motorista.funcaoNome ? ` — ${motorista.funcaoNome}` : ""}`}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px]",
        emUso ? "border-amber-500/50 bg-amber-500/5" : "border-border",
        isDragging && "opacity-50",
      )}
    >
      {!desabilitado && (
        <button
          type="button"
          aria-label={`Arrastar ${motorista.nomeCompleto}`}
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={desabilitado || destinos.length === 0}>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left"
            data-testid={`ct5-motorista-menu-${motorista.id}`}
          >
            {motorista.nomeCompleto}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
          <DropdownMenuLabel className="text-[11px]">Aplicar ao caminhão…</DropdownMenuLabel>
          {destinos.map((d) => (
            <DropdownMenuItem
              key={d.chaveLocal}
              className="text-xs"
              onSelect={() => onAplicar(d.chaveLocal)}
            >
              {d.rotulo}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export interface MotoristasPanelProps {
  motoristas: CtMotoristaOperacional[];
  isLoading: boolean;
  error: unknown;
  desabilitado: boolean;
  emUso: (motoristaId: string) => boolean;
  destinos: { chaveLocal: string; rotulo: string }[];
  onAplicar: (motoristaId: string, chaveLocal: string) => void;
}

export const MotoristasPanel: React.FC<MotoristasPanelProps> = ({
  motoristas,
  isLoading,
  error,
  desabilitado,
  emUso,
  destinos,
  onAplicar,
}) => {
  const [termo, setTermo] = useState("");

  const filtrados = useMemo(() => {
    const t = termo.trim().toUpperCase();
    if (!t) return motoristas;
    return motoristas.filter((m) =>
      [m.nomeCompleto, m.matricula, m.funcaoNome]
        .filter(Boolean)
        .join(" ")
        .toUpperCase()
        .includes(t),
    );
  }, [motoristas, termo]);

  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid="ct5-painel-motoristas">
      <div className="flex items-center justify-between gap-1">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Motoristas
        </p>
        <Badge variant="outline" className="text-[10px]">
          {filtrados.length}
        </Badge>
      </div>

      <Input
        value={termo}
        placeholder="Buscar motorista..."
        className="h-7 text-[11px]"
        onChange={(e) => setTermo(e.target.value)}
        data-testid="ct5-motoristas-busca"
      />

      {error && (
        <Alert variant="destructive" data-testid="ct5-motoristas-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Falha ao carregar motoristas</AlertTitle>
          <AlertDescription className="text-[11px]">
            Erro técnico da consulta (não significa “nenhum motorista”).
          </AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
        {isLoading ? (
          <>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </>
        ) : filtrados.length === 0 && !error ? (
          <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            Nenhum motorista encontrado.
          </p>
        ) : (
          filtrados.map((m) => (
            <MotoristaItem
              key={m.id}
              motorista={m}
              emUso={emUso(m.id)}
              desabilitado={desabilitado}
              destinos={destinos}
              onAplicar={(chave) => onAplicar(m.id, chave)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MotoristasPanel;
