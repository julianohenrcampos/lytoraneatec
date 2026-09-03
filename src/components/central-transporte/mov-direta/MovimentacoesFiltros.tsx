/**
 * CT-4 Fase 3 — filtros do painel de Movimentações (client-side).
 *
 * Nenhuma query nova: filtra o que `fn_ct_mov_direta_listar` já devolveu.
 */
import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CT_VIAGEM_STATUS_LABELS } from "@/types/centralTransporteMobilizacao";
import {
  filtroAtivo,
  filtroVazio,
  type MovFiltroState,
} from "@/lib/central-transporte/movimentacoesWorkspace";

const STATUS_VISIVEIS = [
  "RASCUNHO",
  "PROGRAMADA",
  "EM_TRANSITO",
  "CONCLUIDA",
  "CANCELADA",
] as const;

interface Props {
  filtros: MovFiltroState;
  onChange: (f: MovFiltroState) => void;
  motoristas: Array<{ value: string; label: string }>;
}

const MovimentacoesFiltros: React.FC<Props> = ({ filtros, onChange, motoristas }) => (
  <div className="grid gap-3 md:grid-cols-4" data-testid="ct4-filtros">
    <div className="space-y-1">
      <Label className="text-[11px]">Busca</Label>
      <Input
        value={filtros.busca}
        placeholder="Buscar MOV, ativo, motorista ou obra..."
        aria-label="Buscar movimentações"
        onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
        data-testid="ct4-filtro-busca"
      />
    </div>

    <div className="space-y-1">
      <Label className="text-[11px]">Status</Label>
      <Combobox
        options={[
          { value: "TODOS", label: "Todos" },
          ...STATUS_VISIVEIS.map((s) => ({ value: s, label: CT_VIAGEM_STATUS_LABELS[s] })),
        ]}
        value={filtros.status}
        placeholder="Todos"
        onChange={(v) => onChange({ ...filtros, status: v || "TODOS" })}
      />
    </div>

    <div className="space-y-1">
      <Label className="text-[11px]">Data prevista de saída</Label>
      <Input
        type="date"
        value={filtros.data}
        aria-label="Data prevista de saída"
        onChange={(e) => onChange({ ...filtros, data: e.target.value })}
      />
    </div>

    <div className="space-y-1">
      <Label className="text-[11px]">Motorista</Label>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            options={[{ value: "TODOS", label: "Todos" }, ...motoristas]}
            value={filtros.motoristaId}
            placeholder="Todos"
            searchPlaceholder="Buscar motorista..."
            onChange={(v) => onChange({ ...filtros, motoristaId: v || "TODOS" })}
          />
        </div>
        {filtroAtivo(filtros) && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Limpar filtros"
            className="h-9 w-9 shrink-0"
            onClick={() => onChange(filtroVazio())}
            data-testid="ct4-filtro-limpar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  </div>
);

export default MovimentacoesFiltros;
