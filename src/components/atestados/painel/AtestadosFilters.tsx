import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AtestadosPainelFilters } from "@/types/atestadoMedico";

interface Props {
  value: AtestadosPainelFilters;
  onChange: (v: AtestadosPainelFilters) => void;
}

export default function AtestadosFilters({ value, onChange }: Props) {
  const set = <K extends keyof AtestadosPainelFilters>(
    k: K,
    v: AtestadosPainelFilters[K]
  ) => onChange({ ...value, [k]: v });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-inicio">Enviado de</Label>
            <Input
              id="f-inicio"
              type="date"
              value={value.data_inicio ?? ""}
              onChange={(e) => set("data_inicio", e.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-fim">Enviado até</Label>
            <Input
              id="f-fim"
              type="date"
              value={value.data_fim ?? ""}
              onChange={(e) => set("data_fim", e.target.value || undefined)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Select
              value={value.prazo ?? "todos"}
              onValueChange={(v) => set("prazo", v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="dentro">Dentro de 24h</SelectItem>
                <SelectItem value="fora">Fora do prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-busca">Buscar</Label>
            <Input
              id="f-busca"
              placeholder="Protocolo, nome ou matrícula"
              value={value.busca ?? ""}
              onChange={(e) => set("busca", e.target.value || undefined)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
