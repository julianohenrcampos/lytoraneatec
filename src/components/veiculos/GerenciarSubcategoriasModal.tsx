
import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Upload } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";

interface Subcategoria {
  id: string;
  categoria_id: string;
  nome_subcategoria: string;
  descricao: string | null;
}

interface CategoriaOption {
  id: string;
  nome_categoria: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categorias: CategoriaOption[];
  canDelete?: boolean;
}

const GerenciarSubcategoriasModal: React.FC<Props> = ({ isOpen, onClose, categorias, canDelete = true }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Subcategoria | null>(null);
  const [categoriaId, setCategoriaId] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSubcategorias = async () => {
    const { data } = await supabase
      .from("bd_subcategorias_ativos")
      .select("*")
      .order("nome_subcategoria");
    if (data) setSubcategorias(data);
  };

  useEffect(() => {
    if (isOpen) {
      fetchSubcategorias();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditing(null);
    setCategoriaId("");
    setNome("");
    setDescricao("");
  };

  const selectSub = (sub: Subcategoria) => {
    setEditing(sub);
    setCategoriaId(sub.categoria_id);
    setNome(sub.nome_subcategoria);
    setDescricao(sub.descricao || "");
  };

  const getCategoriaName = (id: string) =>
    categorias.find((c) => c.id === id)?.nome_categoria || "—";

  const handleSave = async () => {
    if (!nome.trim() || !categoriaId) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("bd_subcategorias_ativos")
          .update({
            categoria_id: categoriaId,
            nome_subcategoria: nome.trim(),
            descricao: descricao.trim() || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Subcategoria atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from("bd_subcategorias_ativos")
          .insert({
            categoria_id: categoriaId,
            nome_subcategoria: nome.trim(),
            descricao: descricao.trim() || null,
          });
        if (error) throw error;
        toast({ title: "Subcategoria criada com sucesso" });
      }
      queryClient.invalidateQueries({ queryKey: ["subcategoriasDropdown"] });
      await fetchSubcategorias();
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!canDelete) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { count } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id", { count: "exact", head: true })
        .eq("subcategoria_ativo_id", editing.id);
      if (count && count > 0) {
        toast({
          title: "Exclusão bloqueada",
          description: `Subcategoria possui ${count} equipamento(s) vinculado(s).`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("bd_subcategorias_ativos").delete().eq("id", editing.id);
      if (error) throw error;
      toast({ title: "Subcategoria excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["subcategoriasDropdown"] });
      await fetchSubcategorias();
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = async (file: File) => {
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      if (!rows.length) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Resolve column names (flexible matching)
      const firstRow = rows[0];
      const keys = Object.keys(firstRow);
      const catCol = keys.find(k => /categoria/i.test(k));
      const subCol = keys.find(k => /subcategoria/i.test(k));

      if (!catCol || !subCol) {
        toast({ title: "Colunas CATEGORIA e SUBCATEGORIA não encontradas", variant: "destructive" });
        setLoading(false);
        return;
      }

      // 1. Get unique categories from file
      const uniqueCats = [...new Set(rows.map(r => (r[catCol] || "").trim()).filter(Boolean))];

      // 2. Fetch existing categories
      const { data: existingCats } = await supabase
        .from("bd_categorias_ativos")
        .select("id, nome_categoria");

      const catMap = new Map<string, string>();
      (existingCats || []).forEach(c => catMap.set(c.nome_categoria.toLowerCase(), c.id));

      // 3. Insert missing categories
      let newCats = 0;
      for (const catName of uniqueCats) {
        if (!catMap.has(catName.toLowerCase())) {
          const { data: inserted, error } = await supabase
            .from("bd_categorias_ativos")
            .insert({ nome_categoria: catName })
            .select("id")
            .single();
          if (error) throw error;
          catMap.set(catName.toLowerCase(), inserted.id);
          newCats++;
        }
      }

      // 4. Fetch existing subcategories
      const { data: existingSubs } = await supabase
        .from("bd_subcategorias_ativos")
        .select("id, categoria_id, nome_subcategoria");

      const subSet = new Set(
        (existingSubs || []).map(s => `${s.categoria_id}|${s.nome_subcategoria.toLowerCase()}`)
      );

      // 5. Insert missing subcategories
      let newSubs = 0;
      let skipped = 0;
      for (const row of rows) {
        const catName = (row[catCol] || "").trim();
        const subName = (row[subCol] || "").trim();
        if (!catName || !subName) { skipped++; continue; }

        const resolvedCatId = catMap.get(catName.toLowerCase());
        if (!resolvedCatId) { skipped++; continue; }

        const key = `${resolvedCatId}|${subName.toLowerCase()}`;
        if (subSet.has(key)) { skipped++; continue; }

        const { error } = await supabase
          .from("bd_subcategorias_ativos")
          .insert({ categoria_id: resolvedCatId, nome_subcategoria: subName });
        if (error) throw error;
        subSet.add(key);
        newSubs++;
      }

      queryClient.invalidateQueries({ queryKey: ["categoriasDropdown"] });
      queryClient.invalidateQueries({ queryKey: ["subcategoriasDropdown"] });
      await fetchSubcategorias();

      toast({
        title: "Importação concluída",
        description: `${newCats} categoria(s) e ${newSubs} subcategoria(s) criadas. ${skipped} já existentes/ignoradas.`,
      });
    } catch (e: any) {
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Subcategorias de Ativos</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Subcategorias existentes</Label>
            <ScrollArea className="h-[280px] border rounded-md p-2">
              {subcategorias.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Nenhuma subcategoria cadastrada.</p>
              )}
              {subcategorias.map((sub) => (
                <div
                  key={sub.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent ${
                    editing?.id === sub.id ? "bg-accent" : ""
                  }`}
                  onClick={() => selectSub(sub)}
                >
                  <div className="truncate">
                    <span className="text-sm">{sub.nome_subcategoria}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({getCategoriaName(sub.categoria_id)})
                    </span>
                  </div>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Categoria *</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome_categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="nome_sub">Nome da Subcategoria *</Label>
              <Input
                id="nome_sub"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Articulado, Mini..."
              />
            </div>
            <div>
              <Label htmlFor="desc_sub">Descrição</Label>
              <Textarea
                id="desc_sub"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportExcel(f);
          }}
        />

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2">
            {editing && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading || !canDelete} size="sm">
                <Trash2 className="mr-1 h-4 w-4" />
                Excluir
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 h-4 w-4" />
              Importar Excel
            </Button>
          </div>
          <div className="flex gap-2">
            {editing && (
              <Button variant="ghost" onClick={resetForm} size="sm">
                Nova Subcategoria
              </Button>
            )}
            <Button variant="outline" onClick={onClose} size="sm">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading} size="sm">
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GerenciarSubcategoriasModal;
