import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { parseContextoOperacional } from "@/utils/registroAplicacao/parseContextoOperacional";
import type { CentroCustoLookup } from "./EntregasEnviadasTable";

interface Props {
  registroId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centroCustoById?: Record<string, CentroCustoLookup>;
}

interface RegistroHeader {
  id: string;
  data_aplicacao: string | null;
  logradouro_aplicado: string | null;
  tonelada_aplicada: number | null;
  atividade: string | null;
  status_aplicacao: string | null;
  centro_custo_id: string | null;
  temperatura_chegada: number | null;
  temperatura_aplicacao: number | null;
  observacoes_gerais: string | null;
}

interface DetalheRow {
  id: string;
  sequencia_aplicacao: number | null;
  tipo_item: string | null;
  bordo: string | null;
  comprimento: number | null;
  largura_media: number | null;
  area_aplicada: number | null;
  tonelada_aplicada: number | null;
  logradouro_nome: string | null;
}

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="space-y-0.5">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm font-medium break-words">
      {value === undefined || value === null || value === "" ? "-" : value}
    </div>
  </div>
);

const VisualizarRegistroManualModal: React.FC<Props> = ({
  registroId,
  open,
  onOpenChange,
  centroCustoById = {},
}) => {
  const headerQ = useQuery({
    queryKey: ["registroManualHeader", registroId],
    enabled: !!registroId && open,
    retry: 0,
    queryFn: async (): Promise<{ data: RegistroHeader | null; error: unknown }> => {
      const { data, error } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .select(
          "id, data_aplicacao, logradouro_aplicado, tonelada_aplicada, atividade, status_aplicacao, centro_custo_id, temperatura_chegada, temperatura_aplicacao, observacoes_gerais"
        )
        .eq("id", registroId!)
        .maybeSingle();
      if (error) console.warn("[VISUALIZAR_MANUAL][HEADER_ERRO]", error);
      return { data: (data as RegistroHeader | null) ?? null, error };
    },
  });

  const detalhesQ = useQuery({
    queryKey: ["registroManualDetalhes", registroId],
    enabled: !!registroId && open,
    retry: 0,
    queryFn: async (): Promise<{ data: DetalheRow[]; error: unknown }> => {
      const { data, error } = await supabase
        .from("bd_registro_aplicacao_detalhes")
        .select(
          "id, sequencia_aplicacao, tipo_item, bordo, comprimento, largura_media, area_aplicada, tonelada_aplicada, logradouro_nome"
        )
        .eq("registro_aplicacao_id", registroId!)
        .order("sequencia_aplicacao", { ascending: true });
      if (error) console.warn("[VISUALIZAR_MANUAL][DETALHES_ERRO]", error);
      return { data: (data as DetalheRow[] | null) ?? [], error };
    },
  });

  const header = headerQ.data?.data ?? null;
  const detalhes = detalhesQ.data?.data ?? [];
  const contexto = parseContextoOperacional(header?.observacoes_gerais);
  const cc = header?.centro_custo_id ? centroCustoById[header.centro_custo_id] : undefined;
  const ccLabel = cc
    ? [cc.codigo_centro_custo, cc.nome_centro_custo].filter(Boolean).join(" — ")
    : header?.centro_custo_id || "-";

  const hasError = !!headerQ.data?.error || !!detalhesQ.data?.error;
  const isLoading = headerQ.isLoading || detalhesQ.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Visualizar Registro Manual</DialogTitle>
          <DialogDescription>
            Leitura apenas. Nenhuma alteração é gravada.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando registro...
          </div>
        )}

        {hasError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Não foi possível carregar os detalhes deste registro.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && header && (
          <div className="space-y-6">
            {/* Cabeçalho */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">Cabeçalho</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field
                  label="Data"
                  value={header.data_aplicacao ? formatBrazilianDateForDisplay(header.data_aplicacao) : "-"}
                />
                <Field label="Atividade" value={header.atividade} />
                <Field
                  label="Status"
                  value={<Badge variant="secondary">{header.status_aplicacao || "Manual"}</Badge>}
                />
                <div className="col-span-2 md:col-span-3">
                  <Field label="Centro de Custo" value={ccLabel} />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <Field label="Logradouro" value={header.logradouro_aplicado} />
                </div>
                <Field
                  label="Tonelada aplicada"
                  value={
                    header.tonelada_aplicada != null
                      ? `${Number(header.tonelada_aplicada).toFixed(2)} t`
                      : "-"
                  }
                />

                <Field
                  label="Temperatura chegada"
                  value={header.temperatura_chegada != null ? `${header.temperatura_chegada} °C` : "-"}
                />
                <Field
                  label="Temperatura aplicação"
                  value={header.temperatura_aplicacao != null ? `${header.temperatura_aplicacao} °C` : "-"}
                />
              </div>
            </section>

            {/* Contexto operacional parseado */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">Contexto operacional</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Equipe" value={contexto.equipe} />
                <Field label="Caminhão/Frota" value={contexto.caminhaoFrota} />
                <Field label="Placa" value={contexto.placa} />
                <Field label="Motorista" value={contexto.motorista} />
                <Field label="Total carga" value={contexto.totalCarga ? `${contexto.totalCarga} t` : undefined} />
                <Field label="Tipo traço" value={contexto.tipoTraco} />
                <Field label="Tipo pintura" value={contexto.tipoPintura} />
                <Field label="Bairro" value={contexto.bairro} />
                <Field label="Cidade" value={contexto.cidade} />
                <Field label="UF" value={contexto.uf} />
                <Field
                  label="Latitude / Longitude"
                  value={
                    contexto.latitude || contexto.longitude
                      ? `${contexto.latitude || "-"}, ${contexto.longitude || "-"}`
                      : undefined
                  }
                />
                <Field label="Origem localização" value={contexto.origemLocalizacao} />
              </div>
            </section>

            {/* Detalhes */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">
                Detalhes ({detalhes.length})
              </h3>
              {detalhes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem detalhes cadastrados.</p>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Seq</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Bordo</TableHead>
                        <TableHead className="text-right">Comp (m)</TableHead>
                        <TableHead className="text-right">Larg (m)</TableHead>
                        <TableHead className="text-right">Área (m²)</TableHead>
                        <TableHead className="text-right">Ton (t)</TableHead>
                        <TableHead>Logradouro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhes.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.sequencia_aplicacao ?? "-"}</TableCell>
                          <TableCell>{d.tipo_item ?? "-"}</TableCell>
                          <TableCell>{d.bordo ?? "-"}</TableCell>
                          <TableCell className="text-right">{d.comprimento ?? "-"}</TableCell>
                          <TableCell className="text-right">{d.largura_media ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            {d.area_aplicada != null ? Number(d.area_aplicada).toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {d.tonelada_aplicada != null ? Number(d.tonelada_aplicada).toFixed(3) : "-"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={d.logradouro_nome ?? ""}>
                            {d.logradouro_nome ?? "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Observações do apontador */}
            {contexto.observacoesApontador && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold border-b pb-1">Observações do apontador</h3>
                <pre className="whitespace-pre-wrap text-xs bg-muted/50 rounded p-3 border">
                  {contexto.observacoesApontador}
                </pre>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VisualizarRegistroManualModal;
