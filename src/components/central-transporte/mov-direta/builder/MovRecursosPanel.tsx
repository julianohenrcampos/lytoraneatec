/**
 * CT-4 Builder — Rail direita: MOTORISTAS e VEÍCULOS TRANSPORTADORES.
 *
 * Fonte de dados: exatamente `useCtMobilizacaoCadastros` (que já prioriza a RPC
 * `fn_motoristas_operacional_lookup`). Recursos são GLOBAIS da viagem: o tom
 * apenas indica se o recurso é o escolhido no rascunho.
 */
import React, { useCallback, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Truck, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { movDragId, type MovDragTipo } from "@/lib/central-transporte/movDiretaBuilder";

interface ItemProps {
  tipo: MovDragTipo;
  opcao: ComboboxOption;
  escolhido: boolean;
  desabilitado: boolean;
  onAplicar: () => void;
}

const RecursoItem: React.FC<ItemProps> = ({
  tipo,
  opcao,
  escolhido,
  desabilitado,
  onAplicar,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: movDragId(tipo, opcao.value),
    disabled: desabilitado,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct4-recurso-${tipo}-${opcao.value}`}
      data-escolhido={escolhido ? "true" : "false"}
      title={opcao.label}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-tight",
        escolhido ? "border-primary/50 bg-primary/5" : "border-border",
        isDragging && "opacity-50",
      )}
    >
      {!desabilitado && (
        <button
          type="button"
          aria-label={`Arrastar ${opcao.label}`}
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-2.5 w-2.5" />
        </button>
      )}
      <button
        type="button"
        disabled={desabilitado}
        className="min-w-0 flex-1 truncate text-left"
        onClick={onAplicar}
      >
        {opcao.label}
      </button>
    </div>
  );
};

export interface MovRecursosPanelProps {
  motoristas: ComboboxOption[];
  veiculos: ComboboxOption[];
  isLoading: boolean;
  desabilitado: boolean;
  /** Oculta os transportadores quando a modalidade é RODANTE. */
  mostrarTransportadores: boolean;
  motoristaId: string | null;
  veiculoId: string | null;
  /** Recebedores possíveis do destino (mesmo cadastro já usado nas paradas). */
  recebedores: ComboboxOption[];
  /** Fallback por clique: o Builder decide a parada alvo. */
  onAplicarRecebedor: (id: string) => void;
  onAplicarMotorista: (id: string) => void;
  onAplicarVeiculo: (id: string) => void;
}

export const MovRecursosPanel: React.FC<MovRecursosPanelProps> = ({
  motoristas,
  veiculos,
  isLoading,
  desabilitado,
  mostrarTransportadores,
  motoristaId,
  veiculoId,
  recebedores,
  onAplicarRecebedor,
  onAplicarMotorista,
  onAplicarVeiculo,
}) => {
  const [termo, setTermo] = useState("");

  const filtrar = useCallback(
    (lista: ComboboxOption[]) => {
      const t = termo.trim().toUpperCase();
      if (!t) return lista;
      return lista.filter((o) =>
        `${o.label} ${o.searchText ?? ""}`.toUpperCase().includes(t),
      );
    },
    [termo],
  );

  const motoristasFiltrados = useMemo(() => filtrar(motoristas), [filtrar, motoristas]);
  const veiculosFiltrados = useMemo(() => filtrar(veiculos), [filtrar, veiculos]);
  const recebedoresFiltrados = useMemo(() => filtrar(recebedores), [filtrar, recebedores]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5" data-testid="ct4-painel-recursos">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">Recursos</p>

      <Input
        value={termo}
        placeholder="Buscar recurso..."
        className="h-7 text-[11px]"
        onChange={(e) => setTermo(e.target.value)}
        data-testid="ct4-recursos-busca"
      />

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <p className="flex items-center gap-1 text-[11px] font-medium">
              <Users className="h-3.5 w-3.5" /> Motoristas
            </p>
            <Badge variant="outline" className="text-[10px]">
              {motoristasFiltrados.length}
            </Badge>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            motoristasFiltrados.map((o) => (
              <RecursoItem
                key={o.value}
                tipo="MOV_MOTORISTA"
                opcao={o}
                escolhido={o.value === motoristaId}
                desabilitado={desabilitado}
                onAplicar={() => onAplicarMotorista(o.value)}
              />
            ))
          )}
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <p className="flex items-center gap-1 text-[11px] font-medium">
              <UserCheck className="h-3.5 w-3.5" /> Recebedores
            </p>
            <Badge variant="outline" className="text-[10px]">
              {recebedoresFiltrados.length}
            </Badge>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-full" />
          ) : (
            recebedoresFiltrados.map((o) => (
              <RecursoItem
                key={o.value}
                tipo="MOV_RECEBEDOR"
                opcao={o}
                escolhido={false}
                desabilitado={desabilitado}
                onAplicar={() => onAplicarRecebedor(o.value)}
              />
            ))
          )}
        </div>

        {mostrarTransportadores && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-1">
              <p className="flex items-center gap-1 text-[11px] font-medium">
                <Truck className="h-3.5 w-3.5" /> Transportadores
              </p>
              <Badge variant="outline" className="text-[10px]">
                {veiculosFiltrados.length}
              </Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-full" />
            ) : (
              veiculosFiltrados.map((o) => (
                <RecursoItem
                  key={o.value}
                  tipo="MOV_TRANSPORTADOR"
                  opcao={o}
                  escolhido={o.value === veiculoId}
                  desabilitado={desabilitado}
                  onAplicar={() => onAplicarVeiculo(o.value)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovRecursosPanel;
