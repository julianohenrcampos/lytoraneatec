import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Brain, Settings, Shield, Trash2, Plus, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracaoSistema, useUpdateConfiguracao } from "@/hooks/useConfiguracaoSistema";

interface MatchingConfig {
  id: string;
  grupo: string;
  nome: string;
  peso: number;
  ativo: boolean;
}

interface MatchingExclusao {
  id: string;
  termo: string;
  motivo: string | null;
  ativo: boolean;
}

export default function ConfiguracoesMatching() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [novoTermo, setNovoTermo] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");

  const scoreMinQuery = useConfiguracaoSistema("score_minimo_inclusao");
  const updateConfig = useUpdateConfiguracao();
  const [scoreMinLocal, setScoreMinLocal] = useState<string | null>(null);
  const scoreMin = scoreMinLocal ?? scoreMinQuery.data ?? "5";

  // Fetch matching config (grupos/pesos)
  const { data: grupos = [], isLoading: loadingGrupos } = useQuery({
    queryKey: ["matching-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_matching_config")
        .select("*")
        .order("grupo");
      if (error) throw error;
      return data as unknown as MatchingConfig[];
    },
  });

  // Fetch exclusões
  const { data: exclusoes = [], isLoading: loadingExclusoes } = useQuery({
    queryKey: ["matching-exclusoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_matching_exclusoes")
        .select("*")
        .order("termo");
      if (error) throw error;
      return data as unknown as MatchingExclusao[];
    },
  });

  // Mutation: update grupo
  const updateGrupo = useMutation({
    mutationFn: async ({ id, peso, ativo }: { id: string; peso?: number; ativo?: boolean }) => {
      const updates: any = {};
      if (peso !== undefined) updates.peso = peso;
      if (ativo !== undefined) updates.ativo = ativo;
      const { error } = await supabase.from("bd_matching_config").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching-config"] });
      toast.success("Grupo atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mutation: add exclusão
  const addExclusao = useMutation({
    mutationFn: async ({ termo, motivo }: { termo: string; motivo: string }) => {
      const { error } = await supabase.from("bd_matching_exclusoes").insert({
        termo: termo.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        motivo,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching-exclusoes"] });
      setNovoTermo("");
      setNovoMotivo("");
      toast.success("Exclusão adicionada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Mutation: toggle exclusão
  const toggleExclusao = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("bd_matching_exclusoes").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching-exclusoes"] });
    },
  });

  // Mutation: delete exclusão
  const deleteExclusao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bd_matching_exclusoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching-exclusoes"] });
      toast.success("Exclusão removida");
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/monitoramento-pncp")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Calibração do Matching Inteligente
            </h1>
            <p className="text-sm text-muted-foreground">
              Ajuste pesos, exclusões e score mínimo sem alterar código
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Grupos / Pesos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5" />
                Grupos Técnicos & Pesos
              </CardTitle>
              <CardDescription>Cada grupo encontrado adiciona seu peso ao score</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="w-24 text-center">Peso</TableHead>
                    <TableHead className="w-20 text-center">Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.nome}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          className="w-20 text-center mx-auto"
                          defaultValue={g.peso}
                          onBlur={(e) => {
                            const peso = parseInt(e.target.value, 10);
                            if (!isNaN(peso) && peso !== g.peso) {
                              updateGrupo.mutate({ id: g.id, peso });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={g.ativo}
                          onCheckedChange={(ativo) => updateGrupo.mutate({ id: g.id, ativo })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Score mínimo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Score Mínimo de Inclusão
              </CardTitle>
              <CardDescription>
                Licitações com score abaixo deste valor não serão incluídas no modo engenharia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-32"
                  value={scoreMin}
                  onChange={(e) => setScoreMinLocal(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    updateConfig.mutate({ chave: "score_minimo_inclusao", valor: scoreMin });
                    setScoreMinLocal(null);
                  }}
                  disabled={updateConfig.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Score 5 = 1 grupo técnico encontrado</p>
                <p>• Score 10 = órgão estratégico ou 2 grupos</p>
                <p>• Score 15+ = alta relevância</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exclusões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-destructive" />
              Lista de Exclusão (Blacklist)
            </CardTitle>
            <CardDescription>
              Termos que, se encontrados na descrição, zeram o score e excluem a licitação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add form */}
            <div className="flex gap-2">
              <Input
                placeholder="Termo de exclusão (ex: limpeza predial)"
                value={novoTermo}
                onChange={(e) => setNovoTermo(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Motivo (opcional)"
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!novoTermo.trim()) return toast.error("Informe o termo");
                  addExclusao.mutate({ termo: novoTermo.trim(), motivo: novoMotivo.trim() });
                }}
                disabled={addExclusao.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Termo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-20 text-center">Ativo</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exclusoes.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{e.termo}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.motivo || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={e.ativo}
                        onCheckedChange={(ativo) => toggleExclusao.mutate({ id: e.id, ativo })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteExclusao.mutate(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {exclusoes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma exclusão cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
