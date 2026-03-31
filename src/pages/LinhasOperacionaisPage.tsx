import React, { useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import MainLayout from "@/components/layout/MainLayout";

interface LinhaOperacional {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  cor_hex: string | null;
  ativo: boolean | null;
}

interface LinhaForm {
  codigo: string;
  nome: string;
  descricao: string;
  cor_hex: string;
  ativo: boolean;
}

const emptyForm: LinhaForm = { codigo: "", nome: "", descricao: "", cor_hex: "#FFD700", ativo: true };

export default function LinhasOperacionaisPage() {
  usePageTitle("Linhas Operacionais");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LinhaOperacional | null>(null);
  const [form, setForm] = useState<LinhaForm>(emptyForm);

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["linhas-operacionais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_linhas_operacionais")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return data as LinhaOperacional[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: LinhaForm & { id?: string }) => {
      const payload = {
        codigo: values.codigo.toUpperCase(),
        nome: values.nome,
        descricao: values.descricao || null,
        cor_hex: values.cor_hex || null,
        ativo: values.ativo,
      };
      if (values.id) {
        const { error } = await supabase.from("bd_linhas_operacionais").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bd_linhas_operacionais").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linhas-operacionais"] });
      toast({ title: "Salvo com sucesso" });
      closeModal();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (l: LinhaOperacional) => {
    setEditing(l);
    setForm({ codigo: l.codigo, nome: l.nome, descricao: l.descricao || "", cor_hex: l.cor_hex || "#FFD700", ativo: l.ativo ?? true });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.codigo || !form.nome) {
      toast({ title: "Preencha código e nome", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ ...form, id: editing?.id });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div></div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Linha
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : linhas.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma linha cadastrada</TableCell></TableRow>
              ) : linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono font-bold">{l.codigo}</TableCell>
                  <TableCell>{l.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{l.descricao || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: l.cor_hex || "#ccc" }} />
                      <span className="text-xs text-muted-foreground">{l.cor_hex}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.ativo ? "default" : "secondary"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Linha" : "Nova Linha Operacional"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="AM" maxLength={5} className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.cor_hex} onChange={(e) => setForm({ ...form, cor_hex: e.target.value })} className="w-10 h-10 rounded border cursor-pointer" />
                  <Input value={form.cor_hex} onChange={(e) => setForm({ ...form, cor_hex: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Linha Amarela" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Terraplanagem" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
