import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2 } from "lucide-react";
import EtapaCard from "./EtapaCard";
import VinculacaoCCSection from "./VinculacaoCCSection";
import { useEtapas, useVinculacoes, useCreateFluxo, useUpdateFluxo, useSaveEtapas, useSaveVinculacoes } from "@/hooks/useFluxoConfig";
import type { FluxoAprovacao, FluxoFormData, EtapaFormData, TipoAprovador } from "@/types/fluxoAprovacao";
import { useToast } from "@/hooks/use-toast";

interface FluxoEditorProps {
  open: boolean;
  onClose: () => void;
  fluxo?: FluxoAprovacao | null;
}

const NEW_ETAPA: EtapaFormData = {
  ordem: 1,
  nome_exibicao: "",
  nome_tecnico: "",
  tipo_aprovador: "gerente_adm" as TipoAprovador,
  cargo_id: null,
  obrigatorio: true,
  permite_multiplo: false,
};

export default function FluxoEditor({ open, onClose, fluxo }: FluxoEditorProps) {
  const isEditing = !!fluxo;
  const { toast } = useToast();

  const [form, setForm] = useState<FluxoFormData>({ nome: "", descricao: "", ativo: true });
  const [etapas, setEtapas] = useState<EtapaFormData[]>([]);
  const [ccIds, setCCIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: existingEtapas } = useEtapas(fluxo?.id || null);
  const { data: existingVinc } = useVinculacoes(fluxo?.id || null);

  const createFluxo = useCreateFluxo();
  const updateFluxo = useUpdateFluxo();
  const saveEtapas = useSaveEtapas();
  const saveVinculacoes = useSaveVinculacoes();

  useEffect(() => {
    if (fluxo) {
      setForm({ nome: fluxo.nome, descricao: fluxo.descricao || "", ativo: fluxo.ativo });
    } else {
      setForm({ nome: "", descricao: "", ativo: true });
    }
  }, [fluxo, open]);

  useEffect(() => {
    if (existingEtapas) {
      setEtapas(existingEtapas.map((e) => ({
        id: e.id,
        ordem: e.ordem,
        nome_exibicao: e.nome_exibicao,
        nome_tecnico: e.nome_tecnico,
        tipo_aprovador: e.tipo_aprovador as TipoAprovador,
        cargo_id: e.cargo_id,
        obrigatorio: e.obrigatorio,
        permite_multiplo: e.permite_multiplo,
      })));
    } else if (!fluxo) {
      setEtapas([]);
    }
  }, [existingEtapas, fluxo]);

  useEffect(() => {
    if (existingVinc) {
      setCCIds(existingVinc.map((v) => v.centro_custo_id));
    } else if (!fluxo) {
      setCCIds([]);
    }
  }, [existingVinc, fluxo]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setEtapas((prev) => {
      const oldIndex = prev.findIndex((e) => (e.id || `new-${prev.indexOf(e)}`) === active.id);
      const newIndex = prev.findIndex((e) => (e.id || `new-${prev.indexOf(e)}`) === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((e, i) => ({ ...e, ordem: i + 1 }));
    });
  }, []);

  const addEtapa = () => {
    setEtapas((prev) => [...prev, { ...NEW_ETAPA, ordem: prev.length + 1 }]);
  };

  const updateEtapa = (index: number, data: Partial<EtapaFormData>) => {
    setEtapas((prev) => prev.map((e, i) => (i === index ? { ...e, ...data } : e)));
  };

  const removeEtapa = (index: number) => {
    setEtapas((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((e, i) => ({ ...e, ordem: i + 1 }));
    });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome do fluxo é obrigatório", variant: "destructive" });
      return;
    }

    if (etapas.length === 0) {
      toast({ title: "Adicione pelo menos uma etapa", variant: "destructive" });
      return;
    }

    const invalidEtapas = etapas.some((e) => !e.nome_exibicao.trim() || !e.nome_tecnico.trim());
    if (invalidEtapas) {
      toast({ title: "Preencha todos os campos das etapas", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let fluxoId: string;

      if (isEditing && fluxo) {
        await updateFluxo.mutateAsync({ id: fluxo.id, data: form });
        fluxoId = fluxo.id;
      } else {
        const created = await createFluxo.mutateAsync(form);
        fluxoId = created.id;
      }

      await saveEtapas.mutateAsync({ fluxoId, etapas });
      await saveVinculacoes.mutateAsync({ fluxoId, ccIds });

      onClose();
    } catch (err) {
      console.error("Erro ao salvar fluxo:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Fluxo" : "Novo Fluxo de Aprovação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome do Fluxo *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Fluxo Padrão de Diárias"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
              <Label>Ativo</Label>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Descrição opcional do fluxo..."
              rows={2}
            />
          </div>

          <Separator />

          {/* Etapas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Etapas do Fluxo</Label>
              <Button type="button" variant="outline" size="sm" onClick={addEtapa}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Etapa
              </Button>
            </div>

            {etapas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                Nenhuma etapa adicionada. Clique em "Adicionar Etapa" para começar.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={etapas.map((e, i) => e.id || `new-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {etapas.map((etapa, index) => (
                      <EtapaCard
                        key={etapa.id || `new-${index}`}
                        etapa={etapa}
                        index={index}
                        onUpdate={updateEtapa}
                        onRemove={removeEtapa}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <Separator />

          {/* Vinculações */}
          <VinculacaoCCSection
            selectedCCIds={ccIds}
            onChange={setCCIds}
            fluxoId={fluxo?.id}
          />

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Fluxo"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
