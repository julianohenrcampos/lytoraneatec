/**
 * T22/T23 — Painel "Comunicação do chamado" dentro da Central do Transporte.
 *
 * SOMENTE LEITURA. Nenhuma tabela nova, nenhuma RPC nova, nenhuma cópia de
 * dado do CHI para a CT.
 *
 * SEGURANÇA: a timeline vem EXCLUSIVAMENTE de `listarEventos`, que chama a RPC
 * `fn_chamado_interno_eventos_listar`. É o SERVIDOR que decide quais eventos
 * (inclusive notas internas) aquele usuário pode enxergar — o frontend não faz
 * leitura direta da tabela de eventos e não reimplementa a regra de
 * visibilidade a partir do papel do usuário.
 */
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Paperclip } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getSignedAnexoUrl,
  listarAnexos,
  listarEventos,
  obterChamado,
  obterPessoasChamado,
} from "@/services/chamadosInternosService";
import { CHAMADO_INTERNO_EVENTO_META } from "@/constants/chamadosInternos";

interface Props {
  open: boolean;
  onClose: () => void;
  chamadoId: string;
}

const dataHoraBR = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const ComunicacaoChamadoSheet: React.FC<Props> = ({ open, onClose, chamadoId }) => {
  const chamado = useQuery({
    enabled: open && !!chamadoId,
    queryKey: ["ct5", "chi-painel", "chamado", chamadoId],
    queryFn: () => obterChamado(chamadoId),
  });
  const pessoas = useQuery({
    enabled: open && !!chamadoId,
    queryKey: ["ct5", "chi-painel", "pessoas", chamadoId],
    queryFn: () => obterPessoasChamado(chamadoId),
  });
  const eventos = useQuery({
    enabled: open && !!chamadoId,
    queryKey: ["ct5", "chi-painel", "eventos", chamadoId],
    queryFn: () => listarEventos(chamadoId),
  });
  const anexos = useQuery({
    enabled: open && !!chamadoId,
    queryKey: ["ct5", "chi-painel", "anexos", chamadoId],
    queryFn: () => listarAnexos(chamadoId),
  });

  const abrirAnexo = async (path: string) => {
    const url = await getSignedAnexoUrl(path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const carregando =
    chamado.isLoading || eventos.isLoading || pessoas.isLoading || anexos.isLoading;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full max-w-xl flex-col gap-3 overflow-y-auto"
        data-testid="ct5-painel-comunicacao-chi"
      >
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono">{chamado.data?.protocolo ?? "Chamado interno"}</span>
            {chamado.data?.status && (
              <Badge variant="outline" className="text-[10px]">
                {String(chamado.data.status).replace(/_/g, " ")}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Comunicação do chamado em modo leitura. Respostas continuam sendo feitas no detalhe do
            chamado.
          </SheetDescription>
        </SheetHeader>

        {carregando ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : chamado.isError || !chamado.data ? (
          <Alert variant="destructive">
            <AlertTitle className="text-xs">Chamado não disponível</AlertTitle>
            <AlertDescription className="text-xs">
              Não foi possível carregar o chamado — ele pode estar fora do seu escopo de acesso.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-1 rounded-md border p-3 text-xs">
              <p className="text-sm font-medium">{chamado.data.titulo}</p>
              <p className="text-[11px] text-muted-foreground">
                Solicitante: {pessoas.data?.solicitante_nome ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Aberto em {dataHoraBR(chamado.data.created_at)}
              </p>
              {chamado.data.descricao && (
                <p className="whitespace-pre-wrap pt-2">{chamado.data.descricao}</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Comunicação
              </p>
              {(eventos.data ?? []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhum evento visível para o seu perfil.
                </p>
              ) : (
                <ul className="space-y-2" data-testid="ct5-chi-timeline">
                  {(eventos.data ?? []).map((ev) => (
                    <li key={ev.id} className="rounded-md border p-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {CHAMADO_INTERNO_EVENTO_META[ev.tipo]?.label ??
                            String(ev.tipo).replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {ev.autor_nome ?? "—"} · {dataHoraBR(ev.created_at)}
                        </span>
                      </div>
                      {ev.mensagem && <p className="whitespace-pre-wrap pt-1">{ev.mensagem}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Anexos
              </p>
              {(anexos.data ?? []).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nenhum anexo autorizado.</p>
              ) : (
                <ul className="space-y-1">
                  {(anexos.data ?? []).map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs hover:bg-muted"
                        onClick={() => void abrirAnexo(a.storage_path)}
                      >
                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{a.nome_arquivo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-auto border-t pt-3">
              <Button asChild variant="outline" size="sm" className="w-full gap-2">
                <Link to={`/chamados-internos/${chamadoId}`} data-testid="ct5-ir-para-chamado">
                  <ExternalLink className="h-4 w-4" /> Abrir chamado completo
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ComunicacaoChamadoSheet;
