import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { SolicitacaoItemInsert, TipoItem, RegimeTrabalho, REGIME_LABELS } from "@/services/solicitacaoItensService";
import { getSubcategoriasDropdown, UNIDADES_CAPACIDADE, buildVariacaoLabel } from "@/services/catalogoVariacoesService";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

interface Props {
  onAdd: (item: SolicitacaoItemInsert & { _displayName?: string }) => void;
  onCancel: () => void;
  editingItem?: (SolicitacaoItemInsert & { _displayName?: string }) | null;
}

const EMPTY: SolicitacaoItemInsert & { _displayName?: string } = {
  tipo_item: "EQUIPAMENTO",
  catalogo_equipamento_id: null,
  item_nao_catalogado: false,
  descricao_livre: "",
  capacidade_descricao: "",
  quantidade: 1,
  com_operador: false,
  regime_trabalho: "SEGUNDA_SEXTA",
  regime_personalizado: "",
  tempo_previsto_dias: null,
  observacoes: "",
  subcategoria_id: null,
  capacidade_valor: null,
  capacidade_unidade: null,
  _displayName: "",
};

const ItemBuilderSubForm: React.FC<Props> = ({ onAdd, onCancel, editingItem }) => {
  const [item, setItem] = useState<SolicitacaoItemInsert & { _displayName?: string }>(
    editingItem || { ...EMPTY }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: subcategorias = [] } = useQuery({ queryKey: ["subcategorias-dd"], queryFn: getSubcategoriasDropdown });

  const subcategoriaOptions = useMemo(() => subcategorias.map((s: any) => ({ value: s.id, label: s.nome_subcategoria })), [subcategorias]);

  const update = (key: string, value: any) => {
    setItem((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const subcategoriaNome = subcategorias.find((s: any) => s.id === item.subcategoria_id)?.nome_subcategoria;
  const previewLabel = !item.item_nao_catalogado && item.subcategoria_id
    ? buildVariacaoLabel(subcategoriaNome, item.capacidade_valor, item.capacidade_unidade)
    : null;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!item.item_nao_catalogado) {
      if (!item.subcategoria_id) {
        e.subcategoria = "Selecione a subcategoria";
      }
    }
    if (item.item_nao_catalogado && (!item.descricao_livre || item.descricao_livre.trim() === "")) {
      e.descricao_livre = "Descrição é obrigatória";
    }
    if (item.quantidade < 1) e.quantidade = "Mínimo 1";
    if (item.regime_trabalho === "PERSONALIZADO" && !item.regime_personalizado?.trim()) {
      e.regime_personalizado = "Descreva o regime personalizado";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    // Build display name
    const displayName = item.item_nao_catalogado
      ? item.descricao_livre || "Item não catalogado"
      : previewLabel || "Equipamento";
    onAdd({ ...item, _displayName: displayName });
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      {/* Tipo */}
      <div>
        <Label className="font-medium">Tipo do Item</Label>
        <RadioGroup
          value={item.tipo_item}
          onValueChange={(v) => update("tipo_item", v as TipoItem)}
          className="flex gap-4 mt-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="EQUIPAMENTO" id="eq" />
            <Label htmlFor="eq" className="cursor-pointer">Equipamento</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="VEICULO" id="ve" />
            <Label htmlFor="ve" className="cursor-pointer">Veículo</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Catalogado ou manual */}
      {!item.item_nao_catalogado ? (
        <div className="space-y-3">
          <div>
            <Label className="font-medium">Subcategoria (Tipo de Equipamento) *</Label>
            <div className="mt-1">
              <Combobox
                options={subcategoriaOptions}
                value={item.subcategoria_id || ""}
                onChange={(v) => update("subcategoria_id", v || null)}
                placeholder="Selecione a subcategoria"
                searchPlaceholder="Buscar..."
                emptyText="Nenhuma encontrada"
              />
            </div>
            {errors.subcategoria && <p className="text-xs text-destructive mt-1">{errors.subcategoria}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Capacidade</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={item.capacidade_valor ?? ""}
                onChange={(e) => update("capacidade_valor", e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Ex: 14"
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select
                value={item.capacidade_unidade || ""}
                onValueChange={(v) => update("capacidade_unidade", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_CAPACIDADE.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {previewLabel && (
            <div className="p-2 rounded bg-muted border text-sm">
              <span className="text-muted-foreground">Preview: </span>
              <strong>{previewLabel}</strong>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Checkbox
              id="nao-catalogado"
              checked={item.item_nao_catalogado}
              onCheckedChange={(checked) => {
                update("item_nao_catalogado", !!checked);
                update("subcategoria_id", null);
                update("capacidade_valor", null);
                update("capacidade_unidade", null);
              }}
            />
            <Label htmlFor="nao-catalogado" className="text-sm text-muted-foreground cursor-pointer">
              Solicitar item não cadastrado no catálogo
            </Label>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Item fora do catálogo — será direcionado para cotação</span>
          </div>
          <div>
            <Label>Descrição do Item *</Label>
            <Input
              value={item.descricao_livre || ""}
              onChange={(e) => update("descricao_livre", e.target.value)}
              placeholder="Ex: Retroescavadeira com braço extensível"
              className={errors.descricao_livre ? "border-destructive" : ""}
            />
            {errors.descricao_livre && <p className="text-xs text-destructive mt-1">{errors.descricao_livre}</p>}
          </div>
          <div>
            <Label>Capacidade / Especificação</Label>
            <Input
              value={item.capacidade_descricao || ""}
              onChange={(e) => update("capacidade_descricao", e.target.value)}
              placeholder="Ex: 22 toneladas"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="back-catalogo"
              checked={false}
              onCheckedChange={() => update("item_nao_catalogado", false)}
            />
            <Label htmlFor="back-catalogo" className="text-sm text-muted-foreground cursor-pointer">
              Voltar a buscar no catálogo
            </Label>
          </div>
        </div>
      )}

      {/* Quantidade + Operador */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min={1}
            value={item.quantidade}
            onChange={(e) => update("quantidade", parseInt(e.target.value) || 1)}
            className={errors.quantidade ? "border-destructive" : ""}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={item.com_operador}
            onCheckedChange={(v) => update("com_operador", v)}
          />
          <Label className="cursor-pointer">Com operador</Label>
        </div>
      </div>

      {/* Regime */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Regime de Trabalho</Label>
          <Select
            value={item.regime_trabalho || ""}
            onValueChange={(v) => update("regime_trabalho", v as RegimeTrabalho)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REGIME_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tempo Previsto (dias)</Label>
          <Input
            type="number"
            min={1}
            value={item.tempo_previsto_dias || ""}
            onChange={(e) => update("tempo_previsto_dias", parseInt(e.target.value) || null)}
          />
        </div>
      </div>

      {item.regime_trabalho === "PERSONALIZADO" && (
        <div>
          <Label>Detalhe do Regime Personalizado *</Label>
          <Input
            value={item.regime_personalizado || ""}
            onChange={(e) => update("regime_personalizado", e.target.value)}
            placeholder="Ex: 12h dia, 12h noite, alternando"
            className={errors.regime_personalizado ? "border-destructive" : ""}
          />
          {errors.regime_personalizado && <p className="text-xs text-destructive mt-1">{errors.regime_personalizado}</p>}
        </div>
      )}

      {/* Observações */}
      <div>
        <Label>Observações</Label>
        <Textarea
          value={item.observacoes || ""}
          onChange={(e) => update("observacoes", e.target.value)}
          placeholder="Observações adicionais..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="button" size="sm" onClick={handleSubmit}>
          {editingItem ? "Atualizar Item" : "Adicionar Item"}
        </Button>
      </div>
    </div>
  );
};

export default ItemBuilderSubForm;
