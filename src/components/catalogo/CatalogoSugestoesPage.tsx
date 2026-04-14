import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Check, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface GrupoSugestao {
  key: string;
  tipo_equipamento_id: string | null;
  fabricante_id: string | null;
  modelo_id: string | null;
  capacidade: string | null;
  tipo_nome: string;
  fabricante_nome: string;
  modelo_nome: string;
  subcategoria_nome: string;
  placas: string[];
  count: number;
  jaCatalogado: boolean;
  equipamento_ids: string[];
  hasMinData: boolean;
}

const CatalogoSugestoesPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState<string | null>(null);

  const { data: grupos = [], isLoading } = useQuery<GrupoSugestao[]>({
    queryKey: ["catalogo-sugestoes"],
    queryFn: async () => {
      const { data: equips, error: eErr } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select(`
          id, tipo_equipamento_id, fabricante_id, modelo_id, capacidade, catalogo_equipamento_id, placa,
          tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
          fabricante:bd_fabricantes(nome),
          modelo:bd_modelos(nome_modelo),
          subcategoria:bd_subcategorias_ativos(nome)
        `)
        .order("tipo_equipamento_id");
      if (eErr) throw eErr;

      const map = new Map<string, GrupoSugestao>();
      for (const eq of equips || []) {
        const e = eq as any;
        const key = `${e.tipo_equipamento_id || ""}|${e.fabricante_id || ""}|${e.modelo_id || ""}|${e.capacidade || ""}`;
        if (!map.has(key)) {
          const tipoNome = e.tipo_equipamento?.descricao_padronizada || "";
          const fabNome = e.fabricante?.nome || "";
          const modNome = e.modelo?.nome_modelo || "";
          const subNome = e.subcategoria?.nome || "";

          map.set(key, {
            key,
            tipo_equipamento_id: e.tipo_equipamento_id,
            fabricante_id: e.fabricante_id,
            modelo_id: e.modelo_id,
            capacidade: e.capacidade,
            tipo_nome: tipoNome || subNome || "Sem classificação",
            fabricante_nome: fabNome,
            modelo_nome: modNome,
            subcategoria_nome: subNome,
            placas: [],
            count: 0,
            jaCatalogado: false,
            equipamento_ids: [],
            hasMinData: !!(tipoNome || fabNome || modNome),
          });
        }
        const g = map.get(key)!;
        g.count++;
        g.equipamento_ids.push(e.id);
        if (e.placa) g.placas.push(e.placa);
        if (e.catalogo_equipamento_id) g.jaCatalogado = true;
      }

      return Array.from(map.values()).sort((a, b) => b.count - a.count);
    },
  });

  const handleCriarCatalogo = async (grupo: GrupoSugestao) => {
    if (!grupo.hasMinData) {
      toast({
        title: "Dados insuficientes",
        description: "Preencha tipo, fabricante ou modelo nos equipamentos antes de criar o catálogo.",
        variant: "destructive",
      });
      return;
    }

    setCreating(grupo.key);
    try {
      const descParts = [grupo.tipo_nome, grupo.fabricante_nome, grupo.modelo_nome].filter((v) => v && v !== "Sem classificação");
      const catalogoData = {
        tipo_equipamento_id: grupo.tipo_equipamento_id || null,
        fabricante_id: grupo.fabricante_id || null,
        modelo_id: grupo.modelo_id || null,
        capacidade: grupo.capacidade || null,
        descricao_padrao: descParts.join(" - ") || "Sem descrição",
        ativo: true,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("bd_catalogo_equipamentos")
        .insert(catalogoData)
        .select("id")
        .single();
      if (insErr) throw insErr;

      for (const eqId of grupo.equipamento_ids) {
        await supabase
          .from("bd_caminhoes_equipamentos")
          .update({ catalogo_equipamento_id: inserted.id } as any)
          .eq("id", eqId);
      }

      toast({ title: "Catálogo criado", description: `${grupo.count} equipamentos vinculados.` });
      queryClient.invalidateQueries({ queryKey: ["catalogo-sugestoes"] });
      queryClient.invalidateQueries({ queryKey: ["catalogos"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCreating(null);
    }
  };

  const pendentes = grupos.filter((g) => !g.jaCatalogado);
  const catalogados = grupos.filter((g) => g.jaCatalogado);

  const renderCardInfo = (g: GrupoSugestao) => {
    const parts: string[] = [];
    if (g.fabricante_nome) parts.push(g.fabricante_nome);
    if (g.modelo_nome) parts.push(g.modelo_nome);
    if (g.capacidade) parts.push(g.capacidade);
    if (parts.length === 0 && g.placas.length > 0) {
      parts.push(`Placas: ${g.placas.slice(0, 3).join(", ")}${g.placas.length > 3 ? "..." : ""}`);
    }
    return parts.join(" • ") || "Sem detalhes adicionais";
  };

  return (
    <div className="space-y-6">


      <p className="text-muted-foreground text-sm">
        Equipamentos agrupados por tipo, fabricante e modelo. Crie entradas no catálogo técnico automaticamente.
      </p>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <>
          {pendentes.length === 0 && catalogados.length === 0 && (
            <div className="text-center text-muted-foreground py-12">Nenhum equipamento encontrado.</div>
          )}

          {pendentes.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Sem catálogo ({pendentes.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pendentes.map((g) => (
                  <Card key={g.key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        {g.tipo_nome}
                        {!g.hasMinData && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-muted-foreground">{renderCardInfo(g)}</p>
                      <Badge variant="secondary">{g.count} equipamento(s)</Badge>
                      <div>
                        <Button
                          size="sm"
                          className="w-full mt-2"
                          disabled={creating === g.key || !g.hasMinData}
                          onClick={() => handleCriarCatalogo(g)}
                        >
                          {creating === g.key ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                          {g.hasMinData ? "Criar Catálogo" : "Classificação incompleta"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {catalogados.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-muted-foreground">Já catalogados ({catalogados.length})</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalogados.map((g) => (
                  <Card key={g.key} className="opacity-60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" /> {g.tipo_nome}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{renderCardInfo(g)}</p>
                      <Badge variant="outline" className="mt-1">{g.count} equipamento(s)</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CatalogoSugestoesPage;
