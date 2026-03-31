import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface LinhaOperacional {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  cor_hex: string | null;
  ativo: boolean | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const GerenciarLinhasOperacionaisModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<LinhaOperacional[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<LinhaOperacional | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [corHex, setCorHex] = useState("#FFD700");
  const [ativo, setAtivo] = useState(true);

  const loadLinhas = async () => {
    const { data, error } = await supabase
      .from("bd_linhas_operacionais")
      .select("*")
      .order("codigo");
    if (!error && data) setLinhas(data as LinhaOperacional[]);
  };

  useEffect(() => {
    if (isOpen) {
      loadLinhas();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditing(null);
    setCodigo("");
    setNome("");
    setDescricao("");
    setCorHex("#FFD700");
    setAtivo(true);
  };

  const selectLinha = (l: LinhaOperacional) => {
    setEditing(l);
    setCodigo(l.codigo);
    setNome(l.nome);
    setDescricao(l.descricao || "");
    setCorHex(l.cor_hex || "#FFD700");
    setAtivo(l.ativo ?? true);
  };

  const handleSave = async () => {
    const codigoUpper = codigo.trim().toUpperCase();
    if (!codigoUpper || !nome.trim()) {
      toast({ title: "Código e nome são obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        codigo: codigoUpper,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        cor_hex: corHex || null,
        ativo,
      };

      if (editing) {
        const { error } = await supabase.from("bd_linhas_operacionais").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Linha atualizada com sucesso" });
      } else {
        const { error } = await supabase.from("bd_linhas_operacionais").insert(payload);
        if (error) throw error;
        toast({ title: "Linha criada com sucesso" });
      }

      queryClient.invalidateQueries({ queryKey: ["linhas-operacionais-dropdown"] });
      queryClient.invalidateQueries({ queryKey: ["linhas-operacionais"] });
      await loadLinhas();
      resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setLoading(true);
    try {
      const { count } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id", { count: "exact", head: true })
        .eq("linha_operacional_id", editing.id);
      if (count && count > 0) {
        toast({
          title: "Exclusão bloqueada",
          description: `Linha possui ${count} equipamento(s) vinculado(s).`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("bd_linhas_operacionais").delete().eq("id", editing.id);
      if (error) throw error;
      toast({ title: "Linha excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["linhas-operacionais-dropdown"] });
      queryClient.invalidateQueries({ queryKey: ["linhas-operacionais"] });
      await loadLinhas();
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
          <DialogTitle>Gerenciar Linhas Operacionais</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Linhas existentes</Label>
            <ScrollArea className="h-[300px] border rounded-md p-2">
              {linhas.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Nenhuma linha cadastrada.</p>
              )}
              {linhas.map((l) => (
                <div
                  key={l.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent ${
                    editing?.id === l.id ? "bg-accent" : ""
                  }`}
                  onClick={() => selectLinha(l)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border shrink-0" style={{ backgroundColor: l.cor_hex || "#ccc" }} />
                    <span className="text-sm font-mono font-semibold">{l.codigo}</span>
                    <span className="text-sm text-muted-foreground">{l.nome}</span>
                    {!l.ativo && (
                      <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                    )}
                  </div>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="AM"
                  maxLength={5}
                />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={corHex}
                    onChange={(e) => setCorHex(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input value={corHex} onChange={(e) => setCorHex(e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Linha Amarela"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Terraplanagem"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="mb-0">Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2">
            {editing && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading} size="sm">
                <Trash2 className="mr-1 h-4 w-4" />
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {editing && (
              <Button variant="ghost" onClick={resetForm} size="sm">
                Nova Linha
              </Button>
            )}
            <Button variant="outline" onClick={onClose} size="sm">
              Fechar
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

export default GerenciarLinhasOperacionaisModal;
