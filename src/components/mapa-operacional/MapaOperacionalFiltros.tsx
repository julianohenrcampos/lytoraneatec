import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eraser, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SITUACOES_VEICULO,
  STATUS_COLORS,
  STATUS_ORDER,
  type MapaOperacionalFiltros as Filtros,
  type PeriodoLocalizacao,
  type StatusMapa,
} from "@/services/mapa-operacional/mapaOperacionalService";
import { useMapaOperacionalFiltroOpcoes } from "@/hooks/useMapaOperacionalFiltroOpcoes";

interface Props {
  filtros: Filtros;
  onChange: (next: Filtros) => void;
  onLimpar: () => void;
  buscaLocal: string;
  onBuscaLocalChange: (v: string) => void;
  onAplicarBusca: () => void;
}

export function MapaOperacionalFiltros({
  filtros,
  onChange,
  onLimpar,
  buscaLocal,
  onBuscaLocalChange,
  onAplicarBusca,
}: Props) {
  const { centros, categorias, subcategorias, operadores } =
    useMapaOperacionalFiltroOpcoes(filtros.categoria_ids ?? []);

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });

  const toggleStatus = (s: StatusMapa) => {
    const current = filtros.status_mapa ?? [];
    set(
      "status_mapa",
      current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
    );
  };

  return (
    <div className="space-y-3">
      <form
        className="grid grid-cols-1 md:grid-cols-12 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAplicarBusca();
        }}
      >
        <div className="md:col-span-4 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={buscaLocal}
            onChange={(e) => onBuscaLocalChange(e.target.value)}
            placeholder="Buscar por frota, placa, categoria, operador..."
            className="pl-8"
          />
        </div>

        <div className="md:col-span-3">
          <MultiCombobox
            options={centros}
            value={filtros.centro_custo_ids ?? []}
            onChange={(v) => set("centro_custo_ids", v)}
            placeholder="Centros de Custo"
          />
        </div>
        <div className="md:col-span-2">
          <MultiCombobox
            options={categorias}
            value={filtros.categoria_ids ?? []}
            onChange={(v) => set("categoria_ids", v)}
            placeholder="Categorias"
          />
        </div>
        <div className="md:col-span-3">
          <MultiCombobox
            options={subcategorias}
            value={filtros.subcategoria_ids ?? []}
            onChange={(v) => set("subcategoria_ids", v)}
            placeholder="Subcategorias"
          />
        </div>

        <div className="md:col-span-3">
          <MultiCombobox
            options={operadores}
            value={filtros.operador_ids ?? []}
            onChange={(v) => set("operador_ids", v)}
            placeholder="Operadores"
          />
        </div>
        <div className="md:col-span-3">
          <MultiCombobox
            options={SITUACOES_VEICULO.map((s) => ({ value: s, label: s }))}
            value={filtros.situacao ?? []}
            onChange={(v) => set("situacao", v)}
            placeholder="Situação"
          />
        </div>

        <div className="md:col-span-2">
          <Select
            value={filtros.periodo_localizacao ?? "TODAS"}
            onValueChange={(v) => set("periodo_localizacao", v as PeriodoLocalizacao)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="2H">Últimas 2h</SelectItem>
              <SelectItem value="24H">Últimas 24h</SelectItem>
              <SelectItem value="7D">Últimos 7 dias</SelectItem>
              <SelectItem value="PERSONALIZADO">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Desatualizado</Label>
          <Input
            type="number"
            min={1}
            max={168}
            value={filtros.limite_desatualizado_horas ?? 24}
            onChange={(e) =>
              set(
                "limite_desatualizado_horas",
                Math.max(1, Number(e.target.value) || 24),
              )
            }
            className="w-16"
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <Toggle
            pressed={!!filtros.somente_nao_conformes}
            onPressedChange={(v) => set("somente_nao_conformes", v)}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            Só NC
          </Toggle>
          <Button type="submit" size="sm">
            Aplicar
          </Button>
        </div>

        {filtros.periodo_localizacao === "PERSONALIZADO" && (
          <>
            <div className="md:col-span-3">
              <Input
                type="datetime-local"
                value={filtros.periodo_inicio ?? ""}
                onChange={(e) => set("periodo_inicio", e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Input
                type="datetime-local"
                value={filtros.periodo_fim ?? ""}
                onChange={(e) => set("periodo_fim", e.target.value)}
              />
            </div>
          </>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.map((s) => {
          const active = (filtros.status_mapa ?? []).includes(s);
          const c = STATUS_COLORS[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                active ? "ring-2 ring-primary" : "",
                c.badgeClass,
              )}
            >
              {c.label}
            </button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={onLimpar} className="ml-auto">
          <Eraser className="h-4 w-4 mr-1" /> Limpar filtros
        </Button>
      </div>
    </div>
  );
}
