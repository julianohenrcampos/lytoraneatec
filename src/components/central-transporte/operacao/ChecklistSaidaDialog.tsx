import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck } from "lucide-react";
import ChecklistDinamico, {
  type ChecklistDetalhadoState,
} from "@/components/apontamento-caminhoes/checklist/ChecklistDinamico";
import type {
  CtChecklistTipo,
  CtViagemOperacaoDetalhe,
} from "@/types/centralTransporteOperacao";
import { getSignedFotoCtUrl, obterCoordenadas } from "@/services/ctOperacaoService";
import { useCtViagemComandos } from "@/hooks/central-transporte/useCtOperacao";
import {
  estadoInicial,
  montarSnapshot,
  observacoesGeraisDoPersistido,
  resolveTemplateCarga,
  TEMPLATE_TRANSPORTADOR,
  todosItens,
  uploadFotosPendentes,
  validarEstado,
  type CtTemplateChecklist,
} from "@/lib/central-transporte/checklistCeCt";
import CtChecklistAtivoHeader from "./CtChecklistAtivoHeader";
import CtFeedbackDialog from "./CtFeedbackDialog";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  detalhe: CtViagemOperacaoDetalhe;
  tipo: CtChecklistTipo;
  movimentacaoId: string | null;
  rotulo: string;
}

/**
 * CT-3E.3 — Checklist de saída da Central do Transporte.
 *
 * O checklist da CARGA usa o motor OFICIAL do Apontamento de C&E: o template é
 * resolvido pela subcategoria canônica do ativo (`resolveTemplateCE`) e a
 * renderização é o próprio `ChecklistDinamico`. O checklist do transportador
 * (prancha/carreta) permanece complementar e nunca substitui o da carga.
 */
const ChecklistSaidaDialog: React.FC<Props> = ({
  aberto,
  onFechar,
  detalhe,
  tipo,
  movimentacaoId,
  rotulo,
}) => {
  const viagemId = detalhe.viagem.id;
  const { salvarChecklist } = useCtViagemComandos(viagemId);

  const carga = useMemo(
    () =>
      tipo === "CARGA"
        ? (detalhe.viagem.cargas.find((c) => c.movimentacaoId === movimentacaoId) ?? null)
        : null,
    [detalhe.viagem.cargas, movimentacaoId, tipo],
  );

  const template: CtTemplateChecklist | null =
    tipo === "TRANSPORTADOR" ? TEMPLATE_TRANSPORTADOR : carga ? resolveTemplateCarga(carga) : null;

  const persistido = useMemo(
    () =>
      detalhe.checklists.find(
        (c) => c.tipo === tipo && (tipo === "TRANSPORTADOR" || c.movimentacaoId === movimentacaoId),
      ) ?? null,
    [detalhe.checklists, movimentacaoId, tipo],
  );

  const [estado, setEstado] = useState<ChecklistDetalhadoState>(() =>
    template ? estadoInicial(template, persistido) : {},
  );
  const [observacoes, setObservacoes] = useState(() => observacoesGeraisDoPersistido(persistido));
  const [showValidation, setShowValidation] = useState(false);
  const [assinatura, setAssinatura] = useState(false);
  const [salvando, setSalvando] = useState<"RASCUNHO" | "CONCLUIDO" | null>(null);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { tipo: "SUCESSO" | "ERRO"; titulo: string; mensagem: string | null; fecharAoOk: boolean } | null
  >(null);
  const sujoRef = useRef(false);

  const marcaPersistida = useMemo(
    () =>
      [
        persistido?.id ?? "novo",
        persistido?.status ?? "",
        persistido?.realizadoEm ?? "",
        Object.keys(persistido?.respostas ?? {}).length,
      ].join("|"),
    [persistido],
  );

  useEffect(() => {
    if (!aberto) {
      sujoRef.current = false;
      return;
    }
    if (sujoRef.current || !template) return;
    setEstado(estadoInicial(template, persistido));
    setObservacoes(observacoesGeraisDoPersistido(persistido));
    setAssinatura(persistido?.status === "CONCLUIDO");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, marcaPersistida, template?.codigo]);

  if (!template) {
    return (
      <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Checklist indisponível</DialogTitle>
            <DialogDescription className="text-xs">{rotulo}</DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-xs">Sem template oficial para este ativo</AlertTitle>
            <AlertDescription className="text-xs">
              A subcategoria do equipamento não está vinculada a nenhum checklist oficial de
              Apontamento de C&amp;E. Corrija a classificação do ativo no cadastro antes de
              registrar a saída — a Central não cria checklist genérico.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" className="text-xs" onClick={onFechar}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const concluido = persistido?.status === "CONCLUIDO";
  const pendencias = validarEstado(template, estado);
  const itens = todosItens(template);
  const respondidos = itens.filter((i) => estado[i.codigo]?.status).length;

  const alterarItem = (codigo: string, patch: Partial<ChecklistDetalhadoState[string]>) => {
    sujoRef.current = true;
    setEstado((prev) => ({ ...prev, [codigo]: { ...prev[codigo], ...patch } }));
  };

  const gravar = async (status: "RASCUNHO" | "CONCLUIDO") => {
    setErroInline(null);
    if (status === "CONCLUIDO") {
      setShowValidation(true);
      if (pendencias.length > 0) {
        setErroInline(
          "Existem itens obrigatórios sem resposta, sem justificativa ou sem foto de não conformidade.",
        );
        return;
      }
      if (tipo === "TRANSPORTADOR" && !assinatura) {
        setErroInline("Confirme a assinatura digital para concluir o checklist do transportador.");
        return;
      }
    }
    setSalvando(status);
    try {
      const escopo = tipo === "TRANSPORTADOR" ? "transportador" : `carga/${movimentacaoId}`;
      const comFotos = await uploadFotosPendentes(viagemId, escopo, estado);
      setEstado(comFotos);
      const coords = await obterCoordenadas();
      const snapshot = montarSnapshot({
        template,
        state: comFotos,
        viagemId,
        movimentacaoId: tipo === "TRANSPORTADOR" ? null : movimentacaoId,
        carga,
        fase: "SAIDA",
        observacoesGerais: observacoes,
      });
      const out = await salvarChecklist({
        tipo,
        movimentacaoId: tipo === "TRANSPORTADOR" ? null : movimentacaoId,
        checklistCodigo: template.codigo,
        checklistVersao: template.versao,
        status,
        respostas: snapshot as unknown as Record<string, unknown>,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        assinaturaConfirmada: status === "CONCLUIDO" && tipo === "TRANSPORTADOR" && assinatura,
      });
      if (out.status === "ok") {
        sujoRef.current = false;
        setFeedback({
          tipo: "SUCESSO",
          titulo:
            status === "CONCLUIDO"
              ? "Checklist concluído com sucesso."
              : "Checklist salvo com sucesso.",
          mensagem: `${rotulo} · ${respondidos} de ${itens.length} itens respondidos.`,
          fecharAoOk: true,
        });
        return;
      }
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível salvar o checklist.",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "A operação não foi confirmada pelo servidor. Tente novamente — nada será duplicado.",
        fecharAoOk: false,
      });
    } catch (e) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível salvar o checklist.",
        mensagem: e instanceof Error ? e.message : "Erro inesperado ao gravar o checklist.",
        fecharAoOk: false,
      });
    } finally {
      setSalvando(null);
    }
  };

  return (
    <>
      <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {tipo === "TRANSPORTADOR" ? "Checklist do transportador" : template.nome}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {rotulo} · viagem {detalhe.viagem.codigo}
            </DialogDescription>
          </DialogHeader>

          <CtChecklistAtivoHeader
            carga={carga}
            templateNome={template.nome}
            viagemCodigo={detalhe.viagem.codigo}
            origem={detalhe.viagem.origemCentroCusto}
            destino={detalhe.viagem.destinoCentroCusto}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {template.codigo}
            </Badge>
            {persistido && (
              <Badge variant="secondary" className="text-[10px]" data-testid="ct3e-checklist-estado">
                {concluido ? "Concluído" : "Rascunho gravado"}
              </Badge>
            )}
          </div>

          {concluido && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle className="text-xs">Checklist concluído</AlertTitle>
              <AlertDescription className="text-xs">
                Este snapshot é a evidência da saída. Ele permanece disponível para consulta e o
                recebimento cria uma nova avaliação comparativa.
              </AlertDescription>
            </Alert>
          )}

          {erroInline && (
            <Alert variant="destructive" data-testid="ct3e-checklist-erro">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{erroInline}</AlertDescription>
            </Alert>
          )}

          <ChecklistDinamico
            template={template}
            state={estado}
            onChangeItem={alterarItem}
            showValidation={showValidation}
            showInitialHint={!persistido}
            disabled={salvando !== null}
            resolverFotoUrl={getSignedFotoCtUrl}
          />

          <div className="space-y-1">
            <Label className="text-xs">Observações gerais da saída</Label>
            <Textarea
              rows={2}
              value={observacoes}
              disabled={salvando !== null}
              placeholder="Informações complementares registradas na saída"
              onChange={(e) => {
                sujoRef.current = true;
                setObservacoes(e.target.value);
              }}
            />
          </div>

          {tipo === "TRANSPORTADOR" && (
            <label className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs">
              <Checkbox
                checked={assinatura}
                disabled={salvando !== null}
                onCheckedChange={(v) => setAssinatura(v === true)}
              />
              <span>
                Confirmo, como responsável pela saída, a veracidade das informações registradas
                neste checklist. Caso você ainda não tenha assinatura digital cadastrada, esta
                confirmação é registrada como <strong>aceite eletrônico</strong> (nome, data, IP e
                código de verificação).
              </span>
            </label>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-xs" onClick={onFechar}>
              Fechar
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={salvando !== null}
              onClick={() => gravar("RASCUNHO")}
              data-testid="ct3e-salvar-rascunho"
            >
              {salvando === "RASCUNHO" ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 h-3.5 w-3.5" />
              )}
              Salvar rascunho
            </Button>
            <Button
              className="text-xs"
              disabled={salvando !== null}
              onClick={() => gravar("CONCLUIDO")}
              data-testid="ct3e-concluir-checklist"
            >
              {salvando === "CONCLUIDO" ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              )}
              Concluir checklist
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
          onTentarNovamente={
            feedback.tipo === "ERRO" ? () => setFeedback(null) : undefined
          }
        />
      )}
    </>
  );
};

export default ChecklistSaidaDialog;
