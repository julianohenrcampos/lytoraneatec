import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Loader2,
  PackageCheck,
  Play,
  Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCtViagemComandos,
  useCtViagemOperacao,
} from "@/hooks/central-transporte/useCtOperacao";
import {
  CT_PARADA_STATUS_LABELS,
  type CtOrdemMotorista,
} from "@/types/centralTransporteMobilizacao";
import type { CtChecklistTipo } from "@/types/centralTransporteOperacao";
import ChecklistSaidaDialog from "./ChecklistSaidaDialog";
import RecebimentoDialog from "./RecebimentoDialog";

interface Props {
  ordem: CtOrdemMotorista;
}

/**
 * CT-3E / CT-3F — Painel de operação da viagem.
 * Os botões refletem exclusivamente o que o servidor autorizou no detalhe.
 */
const AcoesViagem: React.FC<Props> = ({ ordem }) => {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const { isLoading, error, detalhe } = useCtViagemOperacao(aberto ? ordem.id : null);
  const { iniciar, registrarChegada, registrarChegadaParada } = useCtViagemComandos(ordem.id);
  const [checklist, setChecklist] = useState<{
    tipo: CtChecklistTipo;
    movimentacaoId: string | null;
    rotulo: string;
  } | null>(null);
  const [recebimento, setRecebimento] = useState(false);
  const [comando, setComando] = useState<"INICIAR" | "CHEGADA" | null>(null);
  const [paradaEmComando, setParadaEmComando] = useState<string | null>(null);
  const [erroComando, setErroComando] = useState<string | null>(null);

  const executar = async (tipo: "INICIAR" | "CHEGADA") => {
    setErroComando(null);
    setComando(tipo);
    try {
      const out = tipo === "INICIAR" ? await iniciar() : await registrarChegada();
      if (out.status === "ok") {
        toast({
          title: tipo === "INICIAR" ? "Transporte iniciado" : "Chegada registrada",
          description:
            tipo === "INICIAR"
              ? "A viagem está em trânsito."
              : "A viagem aguarda o recebimento no destino.",
        });
        return;
      }
      setErroComando(
        out.status === "error"
          ? out.error.message
          : "A operação não foi confirmada. Tente novamente — nada será duplicado.",
      );
    } catch (e) {
      setErroComando(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setComando(null);
    }
  };

  /** CT-4 — chegada registrada parada a parada (viagem multiparadas). */
  const chegarNaParada = async (paradaId: string) => {
    setErroComando(null);
    setParadaEmComando(paradaId);
    try {
      const out = await registrarChegadaParada(paradaId);
      if (out.status === "ok") {
        toast({
          title: "Chegada registrada na parada",
          description: "A parada aguarda a conferência do recebedor.",
        });
        return;
      }
      setErroComando(
        out.status === "error"
          ? out.error.message
          : "A operação não foi confirmada. Tente novamente — nada será duplicado.",
      );
    } catch (e) {
      setErroComando(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setParadaEmComando(null);
    }
  };

  if (!aberto) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-[11px]"
        onClick={() => setAberto(true)}
        data-testid={`ct3e-abrir-operacao-${ordem.id}`}
      >
        <Settings2 className="h-3.5 w-3.5" /> Operação
      </Button>
    );
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  if (error || !detalhe)
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {error instanceof Error ? error.message : "Não foi possível carregar a operação."}
        </AlertDescription>
      </Alert>
    );

  const checklistTransportador = detalhe.checklists.find((c) => c.tipo === "TRANSPORTADOR");
  const podeEditarChecklist =
    detalhe.podeRegistrarChecklist && detalhe.viagem.status === "PROGRAMADA";

  return (
    <div className="w-full space-y-3 rounded-md border bg-muted/30 p-3">
      {erroComando && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{erroComando}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge variant="outline">
          {detalhe.checklistsPendentes === 0
            ? "Checklists concluídos"
            : `${detalhe.checklistsPendentes} checklist(s) pendente(s)`}
        </Badge>
        <Badge variant="secondary">{detalhe.totalCargas} ativo(s) na viagem</Badge>
      </div>

      {detalhe.viagem.modalidade === "TRANSPORTADO" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2">
          <p className="text-xs font-medium">Checklist do transportador</p>
          <div className="flex items-center gap-2">
            {checklistTransportador?.status === "CONCLUIDO" && (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={!podeEditarChecklist}
              onClick={() =>
                setChecklist({
                  tipo: "TRANSPORTADOR",
                  movimentacaoId: null,
                  rotulo: "Conjunto transportador",
                })
              }
            >
              <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
              {checklistTransportador?.status === "CONCLUIDO" ? "Revisar" : "Preencher"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {detalhe.viagem.cargas.map((c) => {
          const cl = detalhe.checklists.find(
            (x) => x.tipo === "CARGA" && x.movimentacaoId === c.movimentacaoId,
          );
          const rotulo =
            [c.frota, c.numeroFrota].filter(Boolean).join("-") || c.placa || "Ativo";
          return (
            <div
              key={c.movimentacaoId ?? c.equipamentoId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2"
            >
              <p className="text-xs font-medium">
                {rotulo}
                {c.placa ? ` · ${c.placa}` : ""}
              </p>
              <div className="flex items-center gap-2">
                {cl?.status === "CONCLUIDO" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  disabled={!podeEditarChecklist || !c.movimentacaoId}
                  onClick={() =>
                    setChecklist({
                      tipo: "CARGA",
                      movimentacaoId: c.movimentacaoId,
                      rotulo,
                    })
                  }
                >
                  <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                  {cl?.status === "CONCLUIDO" ? "Revisar" : "Checklist"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {detalhe.viagem.paradas.length > 0 && (
        <div className="space-y-2" data-testid={`ct4-paradas-${ordem.id}`}>
          <p className="text-xs font-medium">Paradas da viagem</p>
          {detalhe.viagem.paradas.map((p) => {
            const emConferencia = detalhe.paradaAtualId === p.id;
            return (
              <div
                key={p.id}
                className="space-y-1 rounded-md border bg-background p-2"
                data-testid={`ct4-parada-${p.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium">
                    {p.ordem}ª parada · {p.ccCodigo ?? "Sem código"} {p.ccNome ?? ""}
                  </p>
                  <Badge variant={p.status === "CONCLUIDA" ? "secondary" : "outline"} className="text-[10px]">
                    {CT_PARADA_STATUS_LABELS[p.status]}
                  </Badge>
                </div>
                {p.endereco && <p className="text-[11px] text-muted-foreground">{p.endereco}</p>}
                {p.pontoExato && (
                  <p className="text-[11px] text-muted-foreground">Ponto: {p.pontoExato}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {p.cargas.length === 0
                    ? "Nenhum ativo nesta parada."
                    : p.cargas
                        .map((c) => [c.frota, c.numeroFrota].filter(Boolean).join("-") || c.placa)
                        .filter(Boolean)
                        .join(", ")}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.status === "PENDENTE" &&
                    detalhe.viagem.status === "EM_TRANSITO" &&
                    detalhe.souMotorista && (
                      <Button
                        size="sm"
                        className="h-8 text-[11px]"
                        disabled={paradaEmComando !== null}
                        onClick={() => chegarNaParada(p.id)}
                        data-testid={`ct4-chegada-parada-${p.id}`}
                      >
                        {paradaEmComando === p.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Flag className="mr-1 h-3.5 w-3.5" />
                        )}
                        Cheguei nesta parada
                      </Button>
                    )}
                  {emConferencia && detalhe.podeReceber && (
                    <Button
                      size="sm"
                      className="h-8 text-[11px]"
                      onClick={() => setRecebimento(true)}
                      data-testid={`ct4-receber-parada-${p.id}`}
                    >
                      <PackageCheck className="mr-1 h-3.5 w-3.5" /> Conferir entrega desta parada
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {detalhe.viagem.status === "PROGRAMADA" && detalhe.souMotorista && (
          <Button
            size="sm"
            className="h-8 text-[11px]"
            disabled={!detalhe.podeIniciar || comando !== null}
            onClick={() => executar("INICIAR")}
            data-testid={`ct3e-iniciar-${ordem.id}`}
          >
            {comando === "INICIAR" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1 h-3.5 w-3.5" />
            )}
            Iniciar transporte
          </Button>
        )}
        {detalhe.podeRegistrarChegada &&
          detalhe.souMotorista &&
          detalhe.viagem.paradas.length === 0 && (
          <Button
            size="sm"
            className="h-8 text-[11px]"
            disabled={comando !== null}
            onClick={() => executar("CHEGADA")}
            data-testid={`ct3e-chegada-${ordem.id}`}
          >
            {comando === "CHEGADA" ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Flag className="mr-1 h-3.5 w-3.5" />
            )}
            Cheguei ao destino
          </Button>
        )}
        {detalhe.viagem.status === "AGUARDANDO_RECEBIMENTO" &&
          detalhe.podeReceber &&
          detalhe.viagem.paradas.length === 0 && (
          <Button
            size="sm"
            className="h-8 text-[11px]"
            onClick={() => setRecebimento(true)}
            data-testid={`ct3f-receber-${ordem.id}`}
          >
            <PackageCheck className="mr-1 h-3.5 w-3.5" /> Conferir recebimento
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-[11px]"
          onClick={() => setAberto(false)}
        >
          Recolher
        </Button>
      </div>

      {!detalhe.podeIniciar &&
        detalhe.viagem.status === "PROGRAMADA" &&
        detalhe.checklistsPendentes > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Conclua todos os checklists de saída para liberar o início do transporte.
          </p>
        )}

      {checklist && (
        <ChecklistSaidaDialog
          aberto
          onFechar={() => setChecklist(null)}
          detalhe={detalhe}
          tipo={checklist.tipo}
          movimentacaoId={checklist.movimentacaoId}
          rotulo={checklist.rotulo}
        />
      )}
      {recebimento && (
        <RecebimentoDialog
          aberto
          onFechar={() => setRecebimento(false)}
          detalhe={detalhe}
        />
      )}
    </div>
  );
};

export default AcoesViagem;
