import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eraser, Search } from "lucide-react";
import {
  SITUACOES_VEICULO,
  type MapaOperacionalFiltros as Filtros,
  type PeriodoLocalizacao,
} from "@/services/mapa-operacional/mapaOperacionalService";
import { useMapaOperacionalFiltroOpcoes } from "@/hooks/useMapaOperacionalFiltroOpcoes";

interface Props {
  filtros: Filtros;
  onChange: (next: Filtros) => void;
  onLimpar: () => void;
  buscaLocal: string;
  onBuscaLocalChange: (v: string) => void;
}

export function MapaOperacionalFiltros({
  filtros,
  onChange,
  onLimpar,
  buscaLocal,
  onBuscaLocalChange,
}: Props) {
  const { centros, categorias, subcategorias, operadores } =
    useMapaOperacionalFiltroOpcoes(filtros.categoria_ids ?? []);

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    onChange({ ...filtros, [k]: v });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
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

        <div className="md:col-span-3">
          <Select
            value={filtros.periodo_localizacao ?? "HOJE"}
            onValueChange={(v) => set("periodo_localizacao", v as PeriodoLocalizacao)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOJE">Hoje (apontamentos do dia)</SelectItem>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="2H">Últimas 2h</SelectItem>
              <SelectItem value="24H">Últimas 24h</SelectItem>
              <SelectItem value="7D">Últimos 7 dias</SelectItem>
              <SelectItem value="PERSONALIZADO">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onLimpar}>
            <Eraser className="h-4 w-4 mr-1" /> Limpar filtros
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
      </div>
    </div>
  );
}
