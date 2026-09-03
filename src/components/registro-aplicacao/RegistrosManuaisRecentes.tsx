import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList } from "lucide-react";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

interface Props {
  centroCustoId?: string;
  dataInicio?: Date | string;
}

interface CCMap {
  [id: string]: { codigo_centro_custo?: string; nome_centro_custo?: string };
}

const toIso = (d?: Date | string): string | undefined => {
  if (!d) return undefined;
  if (typeof d === "string") return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const RegistrosManuaisRecentes: React.FC<Props> = ({ centroCustoId, dataInicio }) => {
  const dataIso = toIso(dataInicio);

  const query = useQuery({
    queryKey: ["registrosManuaisRecentes", centroCustoId || null, dataIso || null],
    queryFn: async () => {
      let q = supabase
        .from("bd_registro_apontamento_aplicacao")
        .select("id, data_aplicacao, atividade, logradouro_aplicado, tonelada_aplicada, status_aplicacao, centro_custo_id, created_at")
        .eq("origem_registro", "manual")
        .order("created_at", { ascending: false })
        .limit(20);
      if (centroCustoId) q = q.eq("centro_custo_id", centroCustoId);
      if (dataIso) q = q.eq("data_aplicacao", dataIso);
      const { data, error } = await q;
      if (error) throw error;

      const ids = Array.from(new Set((data || []).map((r: any) => r.centro_custo_id).filter(Boolean)));
      const ccMap: CCMap = {};
      if (ids.length) {
        const { data: ccs } = await supabase
          .from("bd_centros_custo")
          .select("id, codigo_centro_custo, nome_centro_custo")
          .in("id", ids as string[]);
        (ccs || []).forEach((c: any) => (ccMap[c.id] = c));
      }
      return { rows: data || [], ccMap };
    },
    staleTime: 60_000,
    retry: 0,
  });

  if (query.isError) {
    console.warn("[REGISTRO_APLICACAO_MANUAL][RECENTES_ERRO]", query.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Registros Manuais Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {query.isError && (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar registros manuais recentes.
          </p>
        )}
        {!query.isLoading && !query.isError && (query.data?.rows.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum registro manual encontrado.</p>
        )}
        {!query.isLoading && !query.isError && (query.data?.rows.length ?? 0) > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Logradouro</TableHead>
                  <TableHead>CC</TableHead>
                  <TableHead>Tonelada</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data!.rows.map((r: any) => {
                  const cc = query.data!.ccMap[r.centro_custo_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{formatBrazilianDateForDisplay(r.data_aplicacao)}</TableCell>
                      <TableCell>{r.atividade || "-"}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{r.logradouro_aplicado || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {cc ? `${cc.codigo_centro_custo || ""} ${cc.nome_centro_custo || ""}`.trim() : "-"}
                      </TableCell>
                      <TableCell>{Number(r.tonelada_aplicada || 0).toFixed(2)} t</TableCell>
                      <TableCell><Badge variant="outline">{r.status_aplicacao || "-"}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RegistrosManuaisRecentes;
