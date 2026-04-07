import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getEmpresasFornecedorasDropdown, PortfolioEmpresa } from "@/services/portfolioEmpresaService";
import { getSubcategoriasDropdown, UNIDADES_CAPACIDADE, buildVariacaoLabel } from "@/services/catalogoVariacoesService";

interface PortfolioItem {
  key: string;
  subcategoria_id: string;
  fabricante: string;
  modelo: string;
  ano_fabricacao: string;
  capacidade_valor: string;
  capacidade_unidade: string;
  quantidade_estimada: string;
  valor_ref_com_operador: string;
  valor_ref_sem_operador: string;
  observacoes: string;
}

const createEmptyItem = (): PortfolioItem => ({
  key: crypto.randomUUID(),
  subcategoria_id: "",
  fabricante: "",
  modelo: "",
  ano_fabricacao: "",
  capacidade_valor: "",
  capacidade_unidade: "",
  quantidade_estimada: "",
  valor_ref_com_operador: "",
  valor_ref_sem_operador: "",
  observacoes: "",
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmitBulk: (empresa_id: string, items: any[]) => Promise<void>;
  onSubmitEdit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  editingItem: PortfolioEmpresa | null;
}

const PortfolioFormModal: React.FC<Props> = ({ isOpen, onClose, onSubmitBulk, onSubmitEdit, isSubmitting, editingItem }) => {
  const { data: empresas = [] } = useQuery({ queryKey: ["empresas-fornecedoras-dd"], queryFn: getEmpresasFornecedorasDropdown });
  const { data: subcategorias = [] } = useQuery({ queryKey: ["subcategorias-dd"], queryFn: getSubcategoriasDropdown });

  const [empresaId, setEmpresaId] = useState("");
  const [items, setItems] = useState<PortfolioItem[]>([createEmptyItem()]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingItem) {
      setEmpresaId(editingItem.empresa_id);
      setItems([{
        key: crypto.randomUUID(),
        subcategoria_id: (editingItem as any).variacao_subcategoria_id || "",
        fabricante: editingItem.fabricante || "",
        modelo: editingItem.modelo || "",
        ano_fabricacao: editingItem.ano_fabricacao || "",
        capacidade_valor: (editingItem as any).variacao_capacidade_valor?.toString() || "",
        capacidade_unidade: (editingItem as any).variacao_capacidade_unidade || "",
        quantidade_estimada: editingItem.quantidade_estimada?.toString() || "",
        valor_ref_com_operador: editingItem.valor_ref_com_operador?.toString() || "",
        valor_ref_sem_operador: editingItem.valor_ref_sem_operador?.toString() || "",
        observacoes: editingItem.observacoes || "",
      }]);
    } else {
      setEmpresaId("");
      setItems([createEmptyItem()]);
    }
  }, [editingItem, isOpen]);

  const empresaOptions = useMemo(() => empresas.map((e) => ({ value: e.id, label: e.nome_empresa })), [empresas]);
  const subcategoriaOptions = useMemo(() => subcategorias.map((s: any) => ({ value: s.id, label: s.nome_subcategoria })), [subcategorias]);

  const selectedEmpresa = empresas.find((e) => e.id === empresaId);

  const updateItem = (key: string, field: keyof PortfolioItem, value: string) => {
    setItems(prev => prev.map(it => it.key === key ? { ...it, [field]: value } : it));
  };

  const removeItem = (key: string) => {
    setItems(prev => prev.filter(it => it.key !== key));
  };

  const addItem = () => {
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const handleSubmit = async () => {
    if (!empresaId) return;
    const validItems = items.filter(it => it.subcategoria_id && it.capacidade_valor && it.capacidade_unidade);
    if (validItems.length === 0) return;

    const mapped = validItems.map(it => ({
      subcategoria_id: it.subcategoria_id,
      capacidade_valor: parseFloat(it.capacidade_valor),
      capacidade_unidade: it.capacidade_unidade,
      fabricante: it.fabricante || null,
      modelo: it.modelo || null,
      ano_fabricacao: it.ano_fabricacao || null,
      quantidade_estimada: it.quantidade_estimada ? parseInt(it.quantidade_estimada) : null,
      valor_ref_com_operador: it.valor_ref_com_operador ? parseFloat(it.valor_ref_com_operador) : null,
      valor_ref_sem_operador: it.valor_ref_sem_operador ? parseFloat(it.valor_ref_sem_operador) : null,
      observacoes: it.observacoes || null,
    }));

    if (editingItem) {
      const item = mapped[0];
      const { findOrCreateVariacao } = await import("@/services/catalogoVariacoesService");
      const variacaoId = await findOrCreateVariacao(item.subcategoria_id, item.capacidade_valor, item.capacidade_unidade);
      await onSubmitEdit({
        id: editingItem.id,
        empresa_id: empresaId,
        catalogo_variacao_id: variacaoId,
        fabricante: item.fabricante,
        modelo: item.modelo,
        ano_fabricacao: item.ano_fabricacao,
        quantidade_estimada: item.quantidade_estimada,
        valor_ref_com_operador: item.valor_ref_com_operador,
        valor_ref_sem_operador: item.valor_ref_sem_operador,
        observacoes: item.observacoes,
      });
    } else {
      await onSubmitBulk(empresaId, mapped);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Portfólio" : "Novo Portfólio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Empresa */}
          <div>
            <Label>Empresa Fornecedora *</Label>
            <Combobox options={empresaOptions} value={empresaId} onChange={setEmpresaId} placeholder="Selecione a empresa" searchPlaceholder="Buscar..." emptyText="Nenhuma encontrada" />
            {selectedEmpresa?.status_homologacao && (
              <Badge variant="outline" className={`mt-1 ${selectedEmpresa.status_homologacao === "HOMOLOGADO" ? "bg-green-100 text-green-800" : selectedEmpresa.status_homologacao === "PENDENTE" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                {selectedEmpresa.status_homologacao}
              </Badge>
            )}
          </div>

          {/* Items */}
          {items.map((item, idx) => {
            const subNome = subcategorias.find((s: any) => s.id === item.subcategoria_id)?.nome_subcategoria;
            const preview = item.subcategoria_id && item.capacidade_valor
              ? buildVariacaoLabel(subNome, parseFloat(item.capacidade_valor) || undefined, item.capacidade_unidade || undefined)
              : null;

            return (
              <div key={item.key} className="border rounded-lg p-4 space-y-3 relative bg-muted/30">
                {items.length > 1 && (
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Item {idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.key)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}

                {/* Row 1: Subcategoria | Fabricante | Modelo */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Subcategoria *</Label>
                    <Combobox options={subcategoriaOptions} value={item.subcategoria_id} onChange={(v) => updateItem(item.key, "subcategoria_id", v)} placeholder="Selecione" searchPlaceholder="Buscar..." emptyText="Nenhuma" />
                  </div>
                  <div>
                    <Label className="text-xs">Fabricante</Label>
                    <Input
                      value={item.fabricante}
                      onChange={(e) => updateItem(item.key, "fabricante", e.target.value.toUpperCase())}
                      placeholder="Ex: VOLVO"
                      className="uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={item.modelo}
                      onChange={(e) => updateItem(item.key, "modelo", e.target.value.toUpperCase())}
                      placeholder="Ex: FMX 500"
                      className="uppercase"
                    />
                  </div>
                </div>

                {/* Row 2: Ano | Capacidade | Unidade */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Ano Fab.</Label>
                    <Input value={item.ano_fabricacao} onChange={(e) => updateItem(item.key, "ano_fabricacao", e.target.value)} placeholder="2024" />
                  </div>
                  <div>
                    <Label className="text-xs">Capacidade *</Label>
                    <Input value={item.capacidade_valor} onChange={(e) => updateItem(item.key, "capacidade_valor", e.target.value)} placeholder="14" />
                  </div>
                  <div>
                    <Label className="text-xs">Unidade *</Label>
                    <Select value={item.capacidade_unidade} onValueChange={(v) => updateItem(item.key, "capacidade_unidade", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {UNIDADES_CAPACIDADE.map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3: Qtd | Vlr c/ Op | Vlr s/ Op */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Qtd Estimada</Label>
                    <Input value={item.quantidade_estimada} onChange={(e) => updateItem(item.key, "quantidade_estimada", e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs">Vlr c/ Op (R$)</Label>
                    <Input value={item.valor_ref_com_operador} onChange={(e) => updateItem(item.key, "valor_ref_com_operador", e.target.value)} placeholder="0,00" />
                  </div>
                  <div>
                    <Label className="text-xs">Vlr s/ Op (R$)</Label>
                    <Input value={item.valor_ref_sem_operador} onChange={(e) => updateItem(item.key, "valor_ref_sem_operador", e.target.value)} placeholder="0,00" />
                  </div>
                </div>

                {/* Observacoes */}
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={item.observacoes} onChange={(e) => updateItem(item.key, "observacoes", e.target.value)} className="min-h-[60px]" />
                </div>

                {preview && (
                  <div className="text-xs text-muted-foreground">Preview: <strong>{preview}</strong></div>
                )}
              </div>
            );
          })}

          {!editingItem && (
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Adicionar Item
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !empresaId || items.every(it => !it.subcategoria_id)}>
            {isSubmitting ? "Salvando..." : editingItem ? "Salvar" : `Salvar ${items.length > 1 ? `(${items.length} itens)` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioFormModal;
