import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, FileText, Loader2, RefreshCw } from "lucide-react";
import type { AtestadoRow } from "@/types/atestadoMedico";
import { useAtestadoArquivoAssinado } from "@/hooks/atestados/useAtestadoArquivoAssinado";

interface Props {
  row: AtestadoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canDownload: boolean;
  initialTab?: "dados" | "arquivo";
}

function fmtBRT(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso;
  }
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function mask(m: string) {
  if (!m) return "";
  if (m.length <= 3) return m;
  return `${m.slice(0, 2)}${"*".repeat(Math.max(0, m.length - 3))}${m.slice(-1)}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground mt-0.5">{children}</div>
    </div>
  );
}

export default function AtestadoDetailModal({
  row,
  open,
  onOpenChange,
  canDownload,
  initialTab = "dados",
}: Props) {
  const {
    loadingId,
    previewFor,
    objectUrl,
    kind,
    error,
    load,
    reset,
    download,
  } = useAtestadoArquivoAssinado();

  // Reset preview when modal closes or the selected row changes.
  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  if (!row) return null;

  const isLoadingThis = loadingId === row.id;
  const hasPreview = previewFor === row.id && !!objectUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Atestado {row.protocolo}</DialogTitle>
          <DialogDescription>
            Detalhes do atestado registrado via canal público.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab} key={`${row.id}-${initialTab}`}>
          <TabsList>
            <TabsTrigger value="dados">
              <Eye className="w-4 h-4 mr-2" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="arquivo">
              <FileText className="w-4 h-4 mr-2" />
              Arquivo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Colaborador">{row.nome_snapshot}</Field>
              <Field label="Matrícula">{mask(row.matricula_snapshot)}</Field>
              <Field label="Centro de custo">{row.centro_custo_snapshot ?? "—"}</Field>
              <Field label="Enviado em">{fmtBRT(row.enviado_em)}</Field>
              <Field label="Data de emissão">{fmtDate(row.data_emissao)}</Field>
              <Field label="Início do afastamento">
                {fmtDate(row.data_inicio_afastamento)}
              </Field>
              <Field label="Dias de afastamento">{row.dias_afastamento}</Field>
              <Field label="Dentro de 24h">
                {row.dentro_prazo_24h ? (
                  <Badge variant="secondary">Sim</Badge>
                ) : (
                  <Badge variant="destructive">Não</Badge>
                )}
              </Field>
              <Field label="Status">
                <Badge variant="outline">{row.status}</Badge>
              </Field>
              <Field label="Notificação e-mail">
                <Badge variant="outline">{row.notificacao_email_status}</Badge>
                <span className="text-xs text-muted-foreground ml-2">
                  tentativas: {row.notificacao_email_tentativas}
                </span>
              </Field>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-sm font-medium text-foreground mb-2">Declarações</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Veracidade">
                  {row.declaracao_veracidade ? (
                    <Badge variant="secondary">Sim</Badge>
                  ) : (
                    <Badge variant="destructive">Não</Badge>
                  )}
                </Field>
                <Field label="Original em 48h">
                  {row.declaracao_original_48h ? (
                    <Badge variant="secondary">Sim</Badge>
                  ) : (
                    <Badge variant="destructive">Não</Badge>
                  )}
                </Field>
                <Field label="Ciência da não-validação">
                  {row.declaracao_ciencia_nao_validacao ? (
                    <Badge variant="secondary">Sim</Badge>
                  ) : (
                    <Badge variant="destructive">Não</Badge>
                  )}
                </Field>
                <Field label="Aceitas em">{fmtBRT(row.declaracoes_aceitas_em)}</Field>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="text-sm font-medium text-foreground mb-2">
                Sistema afetado
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Sistema">
                  {row.sistema_afetado_codigo
                    ? `${row.sistema_afetado_codigo} - ${row.sistema_afetado_descricao ?? "—"}`
                    : "—"}
                </Field>
                {row.sistema_afetado_codigo === "21" && (
                  <Field label="Observação">
                    <span className="whitespace-pre-wrap">
                      {row.sistema_afetado_observacao ?? "—"}
                    </span>
                  </Field>
                )}
              </div>
            </div>

            {row.alertas_gerados && row.alertas_gerados.length > 0 && (
              <div className="border-t border-border pt-4">
                <div className="text-sm font-medium text-foreground mb-2">
                  Alertas gerados
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.alertas_gerados.map((a, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      {a.codigo}
                      {a.meta && Object.keys(a.meta).length > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          ({Object.entries(a.meta)
                            .map(([k, v]) => `${k}=${String(v)}`)
                            .join(", ")})
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {row.observacao_saude && (
              <div className="border-t border-border pt-4">
                <div className="text-sm font-medium text-foreground mb-1">
                  Observação SSO
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {row.observacao_saude}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="arquivo" className="space-y-3">
            {!canDownload ? (
              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Você não tem permissão para baixar arquivos de atestados.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {!hasPreview && !isLoadingThis && (
                    <Button onClick={() => load(row.id)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Visualizar arquivo
                    </Button>
                  )}
                  {isLoadingThis && (
                    <Button disabled>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Carregando…
                    </Button>
                  )}
                  {hasPreview && (
                    <>
                      <Button onClick={() => download(row.protocolo)}>
                        <Download className="w-4 h-4 mr-2" />
                        Baixar arquivo
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => load(row.id, { force: true })}
                        disabled={isLoadingThis}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Atualizar arquivo
                      </Button>
                    </>
                  )}
                </div>

                {hasPreview && kind === "pdf" && (
                  <>
                    <iframe
                      src={objectUrl!}
                      title={`Atestado ${row.protocolo}`}
                      className="w-full h-[70vh] rounded-md border border-border bg-white"
                    />
                    <p className="text-xs text-muted-foreground">
                      Caso a pré-visualização não carregue, use o botão Baixar arquivo.
                    </p>
                  </>
                )}


                {hasPreview && kind === "image" && (
                  <div className="w-full flex justify-center bg-muted rounded-md border border-border p-2">
                    <img
                      src={objectUrl!}
                      alt={`Arquivo do atestado ${row.protocolo}`}
                      className="max-h-[70vh] object-contain"
                    />
                  </div>
                )}

                {hasPreview && kind === "unknown" && (
                  <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Pré-visualização indisponível para este formato. Use o
                    botão Baixar arquivo.
                  </div>
                )}

                {!hasPreview && !isLoadingThis && error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    Não foi possível exibir o arquivo. Tente novamente.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
