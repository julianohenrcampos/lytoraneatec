/**
 * CT-5 — filtros do painel de Puxadas (client-side).
 *
 * Nenhuma query nova: filtra o que `fn_ct_puxada_listar` já devolveu.
 */
import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CT_PUXADA_STATUS_LABELS } from "@/types/centralTransportePuxada";
import {
  filtroPuxadaAtivo,
  filtroPuxadaVazio,
  type PuxadaFiltroState,
} from "@/lib/central-transporte/puxadasWorkspace";

const STATUS_VISIVEIS = [
  "RASCUNHO",
  "PROGRAMADA",
  "EM_EXECUCAO",
  "CONCLUIDA",
  "CANCELADA",
] as const;

interface Props {
  filtros: PuxadaFiltroState;
  onChange: (f: PuxadaFiltroState) => void;
  centrosCusto: ComboboxOption[];
}

const PuxadasFiltros: React.FC<Props> = ({ filtros, onChange, centrosCusto }) => (
  <div className="grid gap-3 md:grid-cols-4" data-testid="ct5-filtros">
    <div className="space-y-1">
      <Label className="text-[11px]">Busca</Label>
      <Input
        value={filtros.busca}
        placeholder="Buscar PUX, caminhão, motorista ou obra..."
        aria-label="Buscar puxadas"
        onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
        data-testid="ct5-filtro-busca"
      />
    </div>

    <div className="space-y-1">
      <Label className="text-[11px]">Status</Label>
      <Combobox
        options={[
          { value: "TODOS", label: "Todos" },
          ...STATUS_VISIVEIS.map((s) => ({ value: s, label: CT_PUXADA_STATUS_LABELS[s] })),
        ]}
        value={filtros.status}
        placeholder="Todos"
        onChange={(v) => onChange({ ...filtros, status: v || "TODOS" })}
      />
    </div>

    <div className="space-y-1">
      <Label className="text-[11px]">Data da puxada</Label>
      <Input
        type="date"
        value={filtros.data}
        aria-label="Data da puxada"
        onChange={(e) => onChange({ ...filtros, data: e.target.value })}
      />
    </div>

    <div className="space-y-1">
      <Label className="text-[11px]">Centro de custo</Label>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            options={[{ value: "TODOS", label: "Todos" }, ...centrosCusto]}
            value={filtros.centroCustoId}
            placeholder="Todos"
            searchPlaceholder="Buscar centro de custo..."
            onChange={(v) => onChange({ ...filtros, centroCustoId: v || "TODOS" })}
          />
        </div>
        {filtroPuxadaAtivo(filtros) && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Limpar filtros"
            className="h-9 w-9 shrink-0"
            onClick={() => onChange(filtroPuxadaVazio())}
            data-testid="ct5-filtro-limpar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  </div>
);

export default PuxadasFiltros;
