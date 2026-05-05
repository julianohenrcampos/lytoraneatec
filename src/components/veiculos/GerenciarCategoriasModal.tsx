
import React, { useState, useEffect } from "react";
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
import { Pencil, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Categoria {
  id: string;
  nome_categoria: string;
  descricao: string | null;
  ativo: boolean | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  canDelete?: boolean;
}

const GerenciarCategoriasModal: React.FC<Props> = ({ isOpen, onClose, canDelete = true }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const fetchCategorias = async () => {
    const { data } = await supabase
      .from("bd_categorias_ativos")
      .select("*")
      .order("nome_categoria");
    if (data) setCategorias(data);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategorias();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditing(null);
    setNome("");
    setDescricao("");
  };

  const selectCategoria = (cat: Categoria) => {
    setEditing(cat);
    setNome(cat.nome_categoria);
    setDescricao(cat.descricao || "");
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("bd_categorias_ativos")
          .update({ nome_categoria: nome.trim(), descricao: descricao.trim() || null })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Categoria atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from("bd_categorias_ativos")
          .insert({ nome_categoria: nome.trim(), descricao: descricao.trim() || null });
        if (error) throw error;
        toast({ title: "Categoria criada com sucesso" });
      }
      queryClient.invalidateQueries({ queryKey: ["categoriasDropdown"] });
      await fetchCategorias();
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
        .eq("categoria_ativo_id", editing.id);
      if (count && count > 0) {
        toast({
          title: "Exclusão bloqueada",
          description: `Categoria possui ${count} equipamento(s) vinculado(s).`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("bd_categorias_ativos").delete().eq("id", editing.id);
      if (error) throw error;
      toast({ title: "Categoria excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["categoriasDropdown"] });
      queryClient.invalidateQueries({ queryKey: ["subcategoriasDropdown"] });
      await fetchCategorias();
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerenciar Categorias de Ativos</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Categorias existentes</Label>
            <ScrollArea className="h-[250px] border rounded-md p-2">
              {categorias.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Nenhuma categoria cadastrada.</p>
              )}
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent ${
                    editing?.id === cat.id ? "bg-accent" : ""
                  }`}
                  onClick={() => selectCategoria(cat)}
                >
                  <span className="text-sm truncate">{cat.nome_categoria}</span>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome_categoria">Nome da Categoria *</Label>
              <Input
                id="nome_categoria"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Caminhão, Escavadeira..."
              />
            </div>
            <div>
              <Label htmlFor="descricao_categoria">Descrição</Label>
              <Textarea
                id="descricao_categoria"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2">
            {editing && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading || !canDelete} size="sm">
                <Trash2 className="mr-1 h-4 w-4" />
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {editing && (
              <Button variant="ghost" onClick={resetForm} size="sm">
                Nova Categoria
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

export default GerenciarCategoriasModal;
