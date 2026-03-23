import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { EtapaFormData, TipoAprovador } from "@/types/fluxoAprovacao";
import { TIPO_APROVADOR_LABELS } from "@/types/fluxoAprovacao";

interface EtapaCardProps {
  etapa: EtapaFormData;
  index: number;
  onUpdate: (index: number, data: Partial<EtapaFormData>) => void;
  onRemove: (index: number) => void;
}

export default function EtapaCard({ etapa, index, onUpdate, onRemove }: EtapaCardProps) {
  const sortableId = etapa.id || `new-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 bg-card space-y-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Etapa {etapa.ordem}
        </span>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome de Exibição</Label>
          <Input
            value={etapa.nome_exibicao}
            onChange={(e) => onUpdate(index, { nome_exibicao: e.target.value })}
            placeholder="Ex: Aprovação Gerente ADM"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nome Técnico</Label>
          <Input
            value={etapa.nome_tecnico}
            onChange={(e) => onUpdate(index, { nome_tecnico: e.target.value })}
            placeholder="Ex: gerente_adm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de Aprovador</Label>
          <Select
            value={etapa.tipo_aprovador}
            onValueChange={(v) => onUpdate(index, { tipo_aprovador: v as TipoAprovador })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_APROVADOR_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={etapa.obrigatorio}
            onCheckedChange={(v) => onUpdate(index, { obrigatorio: v })}
          />
          <Label className="text-xs">Obrigatório</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={etapa.permite_multiplo}
            onCheckedChange={(v) => onUpdate(index, { permite_multiplo: v })}
          />
          <Label className="text-xs">Permite Múltiplos</Label>
        </div>
      </div>
    </div>
  );
}
