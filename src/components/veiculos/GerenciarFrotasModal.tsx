import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getFrotas, createFrota, updateFrota, checkCodigoExists, type Frota } from "@/services/frotaService";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TIPO_OPTIONS = [
  { value: "PROPRIO", label: "Próprio" },
  { value: "GRUPO", label: "Grupo" },
  { value: "LOCADO", label: "Locado" },
];

const tipoBadgeColor = (tipo: string | null) => {
  switch (tipo) {
    case "PROPRIO": return "success";
    case "GRUPO": return "info";
    case "LOCADO": return "warning";
    default: return "secondary";
  }
};

const GerenciarFrotasModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [frotas, setFrotas] = useState<Frota[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Frota | null>(null);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("PROPRIO");
  const [ativo, setAtivo] = useState(true);

  const loadFrotas = async () => {
    try {
      const data = await getFrotas();
      setFrotas(data);
    } catch (e) {
      console.error("Erro ao carregar frotas:", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFrotas();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditing(null);
    setCodigo("");
    setDescricao("");
    setTipo("PROPRIO");
    setAtivo(true);
  };

  const selectFrota = (frota: Frota) => {
    setEditing(frota);
    setCodigo(frota.codigo);
    setDescricao(frota.descricao || "");
    setTipo(frota.tipo_propriedade_padrao || "PROPRIO");
    setAtivo(frota.ativo ?? true);
  };

  const handleSave = async () => {
    const codigoUpper = codigo.trim().toUpperCase();
    if (!codigoUpper) {
      toast({ title: "Código obrigatório", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const exists = await checkCodigoExists(codigoUpper, editing?.id);
      if (exists) {
        toast({ title: "Código já existe", description: "Use outro código.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const data = {
        codigo: codigoUpper,
        descricao: descricao.trim() || null,
        tipo_propriedade_padrao: tipo,
        ativo,
        empresa_id: null,
      };

      if (editing) {
        await updateFrota(editing.id, data);
        toast({ title: "Frota atualizada com sucesso" });
      } else {
        await createFrota(data);
        toast({ title: "Frota criada com sucesso" });
      }

      queryClient.invalidateQueries({ queryKey: ["frotas-dropdown"] });
      await loadFrotas();
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
        .eq("frota_id", editing.id);
      if (count && count > 0) {
        toast({
          title: "Exclusão bloqueada",
          description: `Frota possui ${count} equipamento(s) vinculado(s).`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("bd_frotas").delete().eq("id", editing.id);
      if (error) throw error;
      toast({ title: "Frota excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["frotas-dropdown"] });
      await loadFrotas();
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
          <DialogTitle>Gerenciar Frotas</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Frotas existentes</Label>
            <ScrollArea className="h-[300px] border rounded-md p-2">
              {frotas.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">Nenhuma frota cadastrada.</p>
              )}
              {frotas.map((f) => (
                <div
                  key={f.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent ${
                    editing?.id === f.id ? "bg-accent" : ""
                  }`}
                  onClick={() => selectFrota(f)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold">{f.codigo}</span>
                    <Badge variant={tipoBadgeColor(f.tipo_propriedade_padrao) as any} className="text-[10px]">
                      {f.tipo_propriedade_padrao || "—"}
                    </Badge>
                    {!f.ativo && (
                      <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
                    )}
                  </div>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Código *</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: LYC, LOC"
                maxLength={10}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição da frota"
              />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {TIPO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                Nova Frota
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

export default GerenciarFrotasModal;
