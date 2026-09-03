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
import { AlertCircle, Loader2, ImageOff } from "lucide-react";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import {
  parseContextoOperacional,
  parseRuasAplicacao,
  type RuaAplicacaoParsed,
} from "@/utils/registroAplicacao/parseContextoOperacional";
import {
  classificarEspessuraMedia,
  computeEspessuraMediaCmFromTotais,
} from "@/utils/registroAplicacao/rateioTonelada";
import { criarSignedUrlFotoManual } from "@/services/registro-aplicacao/uploadFotosManual";
import type { CentroCustoLookup } from "./EntregasEnviadasTable";

function formatBR(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits).replace(".", ",");
}

// ============================================================================
// B.3.5-B — Galeria de fotos por detalhe via signed URLs (bucket privado).
// Nunca usa getPublicUrl. Signed URL válida por 1h.
// ============================================================================
const FotosDetalhe: React.FC<{ detalheId: string; paths: string[] }> = ({
  detalheId,
  paths,
}) => {
  const [urls, setUrls] = React.useState<Array<{ path: string; url: string | null }>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resolved = await Promise.all(
        paths.map(async (p) => {
          const r = await criarSignedUrlFotoManual(p, 3600);
          if (r.ok && r.url) {
            console.log("[REGISTRO_MANUAL][FOTOS_SIGNED_URL_SUCCESS]", {
              detalheId,
              path: p,
            });
            return { path: p, url: r.url };
          }
          console.warn("[REGISTRO_MANUAL][FOTOS_SIGNED_URL_FAIL]", {
            detalheId,
            path: p,
            erro: r.error,
          });
          return { path: p, url: null };
        })
      );
      if (!cancelled) {
        setUrls(resolved);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detalheId, paths.join("|")]);

  if (!paths || paths.length === 0) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando fotos...
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {urls.map((u, idx) =>
        u.url ? (
          <a
            key={idx}
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-16 w-16 rounded overflow-hidden border bg-muted"
          >
            <img
              src={u.url}
              alt={`Foto ${idx + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </a>
        ) : (
          <div
            key={idx}
            className="h-16 w-16 rounded border bg-muted/50 flex flex-col items-center justify-center text-[10px] text-muted-foreground p-1 text-center"
            title="Foto indisponível ou sem permissão."
          >
            <ImageOff className="h-4 w-4 mb-0.5" />
            <span>indisponível</span>
          </div>
        )
      )}
    </div>
  );
};




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
  fotos_aplicacao: string[] | null;
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
          "id, sequencia_aplicacao, tipo_item, bordo, comprimento, largura_media, area_aplicada, tonelada_aplicada, logradouro_nome, fotos_aplicacao"
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
  const ruasParsed = parseRuasAplicacao(header?.observacoes_gerais);
  const cc = header?.centro_custo_id ? centroCustoById[header.centro_custo_id] : undefined;
  const ccLabel = cc
    ? [cc.codigo_centro_custo, cc.nome_centro_custo].filter(Boolean).join(" — ")
    : header?.centro_custo_id || "-";

  // Fallback: agrupa por logradouro_nome se o bloco [RUAS_APLICACAO] não existir/for inválido.
  const detalhesPorLogradouro = React.useMemo(() => {
    const map = new Map<string, DetalheRow[]>();
    for (const d of detalhes) {
      const key = (d.logradouro_nome || "(sem logradouro)").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries());
  }, [detalhes]);


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



            {/* Contexto operacional (apenas dados do caminhão/equipe) */}
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
              </div>
            </section>

            {/* Resumo técnico da aplicação */}
            {(() => {
              const areaTotal = detalhes.reduce(
                (s, d) => s + (Number(d.area_aplicada) || 0),
                0
              );
              const somaTonDetalhes = detalhes.reduce(
                (s, d) => s + (Number(d.tonelada_aplicada) || 0),
                0
              );
              const cargaPreferida = Number(contexto.totalCarga);
              const cargaValida =
                Number.isFinite(cargaPreferida) && cargaPreferida > 0;
              const cargaTotal = cargaValida ? cargaPreferida : somaTonDetalhes;
              const cargaEstimada = !cargaValida && somaTonDetalhes > 0;
              const espessuraCm = computeEspessuraMediaCmFromTotais(
                cargaTotal,
                areaTotal,
                2.4
              );
              const classif = classificarEspessuraMedia(espessuraCm);
              const badgeCls =
                classif.tone === "success"
                  ? "bg-emerald-600 text-white border-transparent hover:bg-emerald-600"
                  : classif.tone === "warning"
                  ? "bg-amber-500 text-white border-transparent hover:bg-amber-500"
                  : classif.tone === "destructive"
                  ? "bg-destructive text-destructive-foreground border-transparent hover:bg-destructive"
                  : "bg-muted text-muted-foreground border-transparent";
              return (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold border-b pb-1">
                    Resumo técnico da aplicação
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Field
                      label="Área total aplicada"
                      value={areaTotal > 0 ? `${formatBR(areaTotal)} m²` : "—"}
                    />
                    <Field
                      label={`Carga total${cargaEstimada ? " (estimada)" : ""}`}
                      value={cargaTotal > 0 ? `${formatBR(cargaTotal)} t` : "—"}
                    />
                    <Field label="Densidade" value="2,4 t/m³" />
                    <div className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">
                        Espessura média
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {espessuraCm > 0 ? `${formatBR(espessuraCm)} cm` : "—"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${badgeCls}`}
                          title={classif.mensagem}
                        >
                          {classif.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {cargaEstimada && (
                    <p className="text-xs text-muted-foreground">
                      Carga calculada a partir da soma dos apontamentos (total do caminhão não informado).
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{classif.mensagem}</p>
                </section>
              );
            })()}



            {/* Detalhes agrupados por rua */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold border-b pb-1">
                Detalhes por rua ({ruasParsed ? ruasParsed.length : detalhesPorLogradouro.length} rua
                {(ruasParsed ? ruasParsed.length : detalhesPorLogradouro.length) === 1 ? "" : "s"} · {detalhes.length} apontamento{detalhes.length === 1 ? "" : "s"})
              </h3>

              {detalhes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem detalhes cadastrados.</p>
              ) : ruasParsed ? (
                <div className="space-y-4">
                  {ruasParsed.map((r: RuaAplicacaoParsed) => (
                    <div key={r.idLocal || `${r.sequenciaRua}-${r.logradouro}`} className="border rounded-md">
                      <div className="bg-muted/40 border-b px-3 py-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-medium text-sm">
                            Rua {r.sequenciaRua}: {r.logradouro}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {r.buracos.length} apontamento{r.buracos.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                          <div><span className="text-muted-foreground">Bairro:</span> {r.bairro || "-"}</div>
                          <div><span className="text-muted-foreground">Cidade:</span> {r.cidade || "-"}</div>
                          <div><span className="text-muted-foreground">UF:</span> {r.uf || "-"}</div>
                          <div>
                            <span className="text-muted-foreground">Área rua:</span> {r.areaRua.toFixed(2)} m²
                          </div>
                          {r.toneladaRua != null && (
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-muted-foreground">Tonelada estimada:</span>{" "}
                              {r.toneladaRua.toFixed(3)} t
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Seq geral</TableHead>
                              <TableHead>Buraco</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Bordo</TableHead>
                              <TableHead className="text-right">Comp (m)</TableHead>
                              <TableHead className="text-right">Larg (m)</TableHead>
                              <TableHead className="text-right">Área (m²)</TableHead>
                              <TableHead className="text-right">Ton (t)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.buracos.map((b) => (
                              <TableRow key={`${r.idLocal}-${b.sequenciaAplicacao}-${b.sequenciaRua}`}>
                                <TableCell>{b.sequenciaAplicacao || "-"}</TableCell>
                                <TableCell>
                                  Buraco {String(b.sequenciaRua).padStart(2, "0")}
                                </TableCell>
                                <TableCell>{b.tipo_item ?? "-"}</TableCell>
                                <TableCell>{b.bordo ?? "-"}</TableCell>
                                <TableCell className="text-right">{b.comprimento ?? "-"}</TableCell>
                                <TableCell className="text-right">{b.larguraMedia ?? "-"}</TableCell>
                                <TableCell className="text-right">{b.area ? b.area.toFixed(2) : "-"}</TableCell>
                                <TableCell className="text-right">
                                  {b.toneladaRateada != null ? b.toneladaRateada.toFixed(3) : "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Fallback: agrupa por logradouro_nome
                <div className="space-y-4">
                  {detalhesPorLogradouro.map(([logr, rows]) => (
                    <div key={logr} className="border rounded-md">
                      <div className="bg-muted/40 border-b px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                        <div className="font-medium text-sm">Rua: {logr}</div>
                        <Badge variant="secondary" className="text-xs">
                          {rows.length} apontamento{rows.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="overflow-x-auto">
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((d) => (
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
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Fotos dos apontamentos (B.3.5-B) */}
            {(() => {
              const comFotos = detalhes.filter(
                (d) => Array.isArray(d.fotos_aplicacao) && d.fotos_aplicacao.length > 0
              );
              if (comFotos.length === 0) return null;
              return (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold border-b pb-1">
                    Fotos dos apontamentos ({comFotos.reduce((s, d) => s + (d.fotos_aplicacao?.length || 0), 0)})
                  </h3>
                  <div className="space-y-3">
                    {comFotos.map((d) => (
                      <div key={d.id} className="border rounded-md p-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          Seq {d.sequencia_aplicacao ?? "-"} · {d.tipo_item ?? "-"}
                          {d.logradouro_nome ? ` · ${d.logradouro_nome}` : ""}
                        </div>
                        <FotosDetalhe detalheId={d.id} paths={d.fotos_aplicacao || []} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

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
