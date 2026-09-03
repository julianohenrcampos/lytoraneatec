import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ClipboardCheck, Loader2 } from "lucide-react";
import { obterCoordenadas, uploadFotoCt } from "@/services/ctOperacaoService";
import { useCtViagemComandos } from "@/hooks/central-transporte/useCtOperacao";
import {
  CT_NAO_CONFORMIDADE_LABEL,
  CT_RESULTADO_LABEL,
  type CtNaoConformidadeTipo,
  type CtRecebimentoItemPayload,
  type CtRecebimentoResultado,
  type CtViagemOperacaoDetalhe,
} from "@/types/centralTransporteOperacao";
import type { ChecklistDetalhadoState } from "@/components/apontamento-caminhoes/checklist/ChecklistDinamico";
import {
  divergencias,
  estadoInicial,
  itensDoPersistido,
  montarSnapshot,
  resolveTemplateCarga,
  rotuloCarga,
  todosItens,
  validarEstado,
  type CtChecklistItemSnapshot,
  type CtTemplateChecklist,
} from "@/lib/central-transporte/checklistCeCt";
import CtRecebimentoItemRow from "./CtRecebimentoItemRow";
import CtChecklistAtivoHeader from "./CtChecklistAtivoHeader";
import CtFeedbackDialog from "./CtFeedbackDialog";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  detalhe: CtViagemOperacaoDetalhe;
}

interface CargaEstado {
  state: ChecklistDetalhadoState;
  recusado: boolean;
  naoConformidadeTipo: CtNaoConformidadeTipo | null;
  observacao: string;
}

/**
 * CT-3F.1 — Recebimento comparativo: para cada ativo, o mesmo checklist oficial
 * usado na saída é reaberto item a item, com a resposta da saída em coluna
 * imutável e a nova avaliação do recebedor ao lado.
 */
const RecebimentoDialog: React.FC<Props> = ({ aberto, onFechar, detalhe }) => {
  const viagemId = detalhe.viagem.id;
  const { finalizarRecebimento } = useCtViagemComandos(viagemId);
  /* CT-4 — quando a viagem tem paradas, o recebimento conferido é o da parada
     em que o motorista registrou chegada (o servidor valida o mesmo escopo). */
  const paradaId = detalhe.paradaAtualId;
  const cargas = useMemo(
    () =>
      paradaId
        ? detalhe.viagem.cargas.filter((c) => (c.paradaId ?? null) === paradaId)
        : detalhe.viagem.cargas,
    [detalhe.viagem.cargas, paradaId],
  );

  /** Snapshot da saída por carga (evidência imutável). */
  const saidaPorCarga = useMemo(() => {
    const mapa = new Map<string, Record<string, CtChecklistItemSnapshot>>();
    for (const c of detalhe.checklists) {
      if (c.tipo !== "CARGA" || !c.movimentacaoId) continue;
      mapa.set(c.movimentacaoId, itensDoPersistido(c));
    }
    return mapa;
  }, [detalhe.checklists]);

  const templates = useMemo(() => {
    const mapa = new Map<string, CtTemplateChecklist | null>();
    for (const c of cargas) mapa.set(c.movimentacaoId ?? c.equipamentoId, resolveTemplateCarga(c));
    return mapa;
  }, [cargas]);

  const [selecionada, setSelecionada] = useState<string>(
    () => cargas[0]?.movimentacaoId ?? cargas[0]?.equipamentoId ?? "",
  );
  const [estados, setEstados] = useState<Record<string, CargaEstado>>({});
  const [recebedor, setRecebedor] = useState(detalhe.recebimento?.recebedorNome ?? "");
  const [documento, setDocumento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [assinatura, setAssinatura] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tipo: "SUCESSO" | "ERRO"; titulo: string; mensagem: string | null; fecharAoOk: boolean } | null
  >(null);

  /** Hidratação: a avaliação do recebimento nasce igual à saída (comparação real). */
  useEffect(() => {
    if (!aberto) return;
    setEstados((prev) => {
      const next = { ...prev };
      for (const c of cargas) {
        const chave = c.movimentacaoId ?? c.equipamentoId;
        if (next[chave]) continue;
        const template = templates.get(chave);
        if (!template) continue;
        next[chave] = {
          state: estadoInicial(
            template,
            null,
            c.movimentacaoId ? saidaPorCarga.get(c.movimentacaoId) : undefined,
          ),
          recusado: false,
          naoConformidadeTipo: null,
          observacao: "",
        };
      }
      return next;
    });
  }, [aberto, cargas, saidaPorCarga, templates]);

  const cargaAtual = cargas.find((c) => (c.movimentacaoId ?? c.equipamentoId) === selecionada) ?? null;
  const templateAtual = templates.get(selecionada) ?? null;
  const estadoAtual = estados[selecionada] ?? null;
  const saidaAtual = cargaAtual?.movimentacaoId
    ? (saidaPorCarga.get(cargaAtual.movimentacaoId) ?? {})
    : {};

  const resultadoDe = (chave: string): CtRecebimentoResultado => {
    const e = estados[chave];
    const template = templates.get(chave);
    if (!e || !template) return "ACEITO";
    if (e.recusado) return "RECUSADO";
    const temNaoOk = todosItens(template).some((i) => e.state[i.codigo]?.status === "NAO_OK");
    return temNaoOk ? "ACEITO_COM_RESSALVA" : "ACEITO";
  };

  const alterarItem = (codigo: string, patch: Partial<ChecklistDetalhadoState[string]>) =>
    setEstados((prev) => {
      const atual = prev[selecionada];
      if (!atual) return prev;
      return {
        ...prev,
        [selecionada]: {
          ...atual,
          state: { ...atual.state, [codigo]: { ...atual.state[codigo], ...patch } },
        },
      };
    });

  const semTemplate = cargas.filter((c) => !templates.get(c.movimentacaoId ?? c.equipamentoId));

  const enviar = async () => {
    setErro(null);
    setShowValidation(true);
    if (!recebedor.trim()) {
      setErro("Informe o nome de quem está recebendo.");
      return;
    }
    if (!assinatura) {
      setErro("Confirme a assinatura digital para fechar o recebimento.");
      return;
    }
    if (semTemplate.length > 0) {
      setErro(
        "Há ativos sem checklist oficial vinculado à subcategoria. Corrija o cadastro antes de receber.",
      );
      return;
    }
    for (const c of cargas) {
      const chave = c.movimentacaoId ?? c.equipamentoId;
      const template = templates.get(chave);
      const e = estados[chave];
      if (!template || !e) {
        setErro("Recarregue a página: a conferência de um dos ativos não foi carregada.");
        return;
      }
      if (validarEstado(template, e.state).length > 0) {
        setSelecionada(chave);
        setErro(
          `Conferência incompleta em ${rotuloCarga(c)}: responda os itens obrigatórios e justifique com foto as não conformidades.`,
        );
        return;
      }
      const resultado = resultadoDe(chave);
      if (resultado !== "ACEITO") {
        if (!e.observacao.trim()) {
          setSelecionada(chave);
          setErro(`Descreva o motivo da ${resultado === "RECUSADO" ? "recusa" : "ressalva"} em ${rotuloCarga(c)}.`);
          return;
        }
        if (!e.naoConformidadeTipo) {
          setSelecionada(chave);
          setErro(`Classifique a não conformidade de ${rotuloCarga(c)}.`);
          return;
        }
      }
    }

    setSalvando(true);
    try {
      const coords = await obterCoordenadas();
      const itensPayload: CtRecebimentoItemPayload[] = [];
      const estadosAtualizados: Record<string, CargaEstado> = { ...estados };

      for (const c of cargas) {
        const chave = c.movimentacaoId ?? c.equipamentoId;
        const template = templates.get(chave) as CtTemplateChecklist;
        const e = estados[chave];
        // fotos do recebimento já são enviadas no momento da captura (CtFotoField)
        const snapshot = montarSnapshot({
          template,
          state: e.state,
          viagemId,
          movimentacaoId: c.movimentacaoId ?? null,
          carga: c,
          fase: "RECEBIMENTO",
          observacoesGerais: e.observacao,
        });
        const fotosItens = Object.values(e.state).flatMap((i) => i.fotosSalvas);
        const resultado = resultadoDe(chave);
        itensPayload.push({
          movimentacaoId: c.movimentacaoId ?? "",
          resultado,
          naoConformidadeTipo: resultado === "ACEITO" ? null : e.naoConformidadeTipo,
          observacao: e.observacao.trim() || null,
          fotos: fotosItens,
          respostas: snapshot as unknown as Record<string, unknown>,
        });
        estadosAtualizados[chave] = e;
      }
      setEstados(estadosAtualizados);

      const out = await finalizarRecebimento({
        paradaId,
        recebedorNome: recebedor.trim(),
        recebedorDocumento: documento.trim() || null,
        observacoes: observacoes.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        fotos: [],
        assinaturaConfirmada: assinatura,
        itens: itensPayload,
      });
      if (out.status === "ok") {
        setFeedback({
          tipo: "SUCESSO",
          titulo: "Recebimento registrado com sucesso.",
          mensagem:
            "Centro de custo e localização dos ativos aceitos foram atualizados; ressalvas e recusas seguem para tratativa.",
          fecharAoOk: true,
        });
        return;
      }
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível registrar o recebimento.",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "A operação não foi confirmada pelo servidor. Tente novamente — o recebimento não será duplicado.",
        fecharAoOk: false,
      });
    } catch (e) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível registrar o recebimento.",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
        fecharAoOk: false,
      });
    } finally {
      setSalvando(false);
    }
  };

  const divergentesAtual =
    templateAtual && estadoAtual ? divergencias(templateAtual, saidaAtual, estadoAtual.state) : [];

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Conferência de recebimento</DialogTitle>
            <DialogDescription className="text-xs">
              Viagem {detalhe.viagem.codigo} · destino {detalhe.viagem.destinoCentroCusto ?? "—"}
            </DialogDescription>
          </DialogHeader>

          {erro && (
            <Alert variant="destructive" data-testid="ct3f-recebimento-erro">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{erro}</AlertDescription>
            </Alert>
          )}

          {semTemplate.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs">Ativo sem checklist oficial</AlertTitle>
              <AlertDescription className="text-xs">
                {semTemplate.map((c) => rotuloCarga(c)).join(", ")} não possuem subcategoria
                vinculada a um checklist de Apontamento de C&amp;E.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            {cargas.map((c) => {
              const chave = c.movimentacaoId ?? c.equipamentoId;
              const resultado = resultadoDe(chave);
              return (
                <Button
                  key={chave}
                  type="button"
                  size="sm"
                  variant={chave === selecionada ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setSelecionada(chave)}
                  data-testid={`ct3f-aba-${chave}`}
                >
                  {rotuloCarga(c)}
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {CT_RESULTADO_LABEL[resultado]}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {cargaAtual && templateAtual && estadoAtual ? (
            <div className="space-y-3">
              <CtChecklistAtivoHeader
                carga={cargaAtual}
                templateNome={templateAtual.nome}
                viagemCodigo={detalhe.viagem.codigo}
                origem={detalhe.viagem.origemCentroCusto}
                destino={detalhe.viagem.destinoCentroCusto}
              />

              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                <ClipboardCheck className="h-3.5 w-3.5" />
                {Object.keys(saidaAtual).length === 0 ? (
                  <span className="text-muted-foreground">
                    Sem checklist de saída registrado para este ativo — conferência sem base
                    comparativa.
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Comparando com o checklist de saída ({Object.keys(saidaAtual).length} itens) ·{" "}
                    <strong className="text-foreground">
                      {divergentesAtual.length} divergência(s)
                    </strong>
                  </span>
                )}
              </div>

              {templateAtual.grupos.map((g) => (
                <section key={g.codigo} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.titulo}
                  </h4>
                  {g.itens.map((i) => {
                    const item = estadoAtual.state[i.codigo] ?? {
                      observacao: "",
                      fotosSalvas: [],
                      fotosNovas: [],
                    };
                    const invalido =
                      showValidation &&
                      validarEstado(templateAtual, estadoAtual.state).includes(i.codigo);
                    return (
                      <CtRecebimentoItemRow
                        key={i.codigo}
                        item={i}
                        saidaStatus={saidaAtual[i.codigo]?.status ?? null}
                        saidaObservacao={saidaAtual[i.codigo]?.observacao ?? null}
                        saidaFotos={saidaAtual[i.codigo]?.fotos ?? []}
                        status={item.status ?? null}
                        observacao={item.observacao}
                        fotos={item.fotosSalvas}
                        disabled={salvando}
                        invalido={invalido}
                        onStatus={(v) => alterarItem(i.codigo, { status: v })}
                        onObservacao={(v) => alterarItem(i.codigo, { observacao: v })}
                        onUploadFotos={async (files) => {
                          const paths: string[] = [];
                          for (const f of files) {
                            paths.push(
                              await uploadFotoCt(
                                viagemId,
                                `recebimento/${selecionada}/${i.codigo}`,
                                f,
                              ),
                            );
                          }
                          alterarItem(i.codigo, {
                            fotosSalvas: [...item.fotosSalvas, ...paths],
                          });
                        }}
                        onRemoveFoto={(path) =>
                          alterarItem(i.codigo, {
                            fotosSalvas: item.fotosSalvas.filter((p) => p !== path),
                          })
                        }
                      />
                    );
                  })}
                </section>
              ))}

              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium">
                    Resultado deste ativo:{" "}
                    <Badge variant="outline" className="text-[10px]">
                      {CT_RESULTADO_LABEL[resultadoDe(selecionada)]}
                    </Badge>
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={estadoAtual.recusado}
                      disabled={salvando}
                      onCheckedChange={(v) =>
                        setEstados((prev) => ({
                          ...prev,
                          [selecionada]: { ...prev[selecionada], recusado: v === true },
                        }))
                      }
                    />
                    Recusar o recebimento deste ativo
                  </label>
                </div>

                {resultadoDe(selecionada) !== "ACEITO" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Classificação da não conformidade *</Label>
                      <Select
                        value={estadoAtual.naoConformidadeTipo ?? ""}
                        disabled={salvando}
                        onValueChange={(v) =>
                          setEstados((prev) => ({
                            ...prev,
                            [selecionada]: {
                              ...prev[selecionada],
                              naoConformidadeTipo: v as CtNaoConformidadeTipo,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Selecionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CT_NAO_CONFORMIDADE_LABEL).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Motivo consolidado *</Label>
                      <Textarea
                        rows={2}
                        disabled={salvando}
                        value={estadoAtual.observacao}
                        placeholder="Resumo do que impede o aceite integral"
                        onChange={(e) =>
                          setEstados((prev) => ({
                            ...prev,
                            [selecionada]: { ...prev[selecionada], observacao: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum ativo conferível nesta viagem.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Recebedor *</Label>
              <Input
                value={recebedor}
                disabled={salvando}
                onChange={(e) => setRecebedor(e.target.value)}
                placeholder="Nome de quem recebe"
                data-testid="ct3f-recebedor"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Documento (opcional)</Label>
              <Input
                value={documento}
                disabled={salvando}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="CPF ou matrícula"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações gerais do recebimento</Label>
            <Textarea
              rows={2}
              value={observacoes}
              disabled={salvando}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações complementares da entrega"
            />
          </div>

          <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs">
            <Checkbox
              checked={assinatura}
              disabled={salvando}
              onCheckedChange={(v) => setAssinatura(v === true)}
            />
            <span>
              Confirmo, como recebedor, a conferência item a item registrada acima (assinatura
              digital).
            </span>
          </label>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-xs" onClick={onFechar} disabled={salvando}>
              Fechar
            </Button>
            <Button
              className="text-xs"
              onClick={enviar}
              disabled={salvando}
              data-testid="ct3f-finalizar"
            >
              {salvando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Registrar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {feedback && (
        <CtFeedbackDialog
          aberto
          tipo={feedback.tipo}
          titulo={feedback.titulo}
          mensagem={feedback.mensagem}
          onFechar={() => {
            const fechar = feedback.fecharAoOk;
            setFeedback(null);
            if (fechar) onFechar();
          }}
          onTentarNovamente={feedback.tipo === "ERRO" ? () => setFeedback(null) : undefined}
        />
      )}
    </>
  );
};

export default RecebimentoDialog;
