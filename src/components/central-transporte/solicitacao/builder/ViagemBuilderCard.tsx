/**
 * CT-6.2 — Card consolidado de viagem no Canvas do Transport Builder.
 *
 * Mostra SOMENTE o essencial (carga, motorista, data única, resumo da entrega e
 * recebedor). Endereço, mapa, terceiro e campos técnicos vivem no Dialog central
 * "Dados da entrega"; o Sheet permanece apenas como diagnóstico avançado.
 *
 * Todo recurso atribuído é reversível por [×] — a remoção só limpa a associação
 * no rascunho: nada é apagado no cadastro e nenhuma operação de backend roda.
 */
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  MapPin,
  Route,
  Settings2,
  Trash2,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { rotuloAtivo } from "@/lib/central-transporte/mobilizacaoRascunho";
import {
  CT_BUILDER_MAX_CARGA,
  dropId,
  origemDoAgrupamento,
  patchDataUnica,
  vereditoCard,
} from "@/lib/central-transporte/transportBuilder";
import type {
  CtAtivoMobilizavel,
  CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";
import { rotuloCc, type CcGeoInfo } from "@/utils/central-transporte/autoPreencherViagem";

export interface ViagemBuilderCardProps {
  viagem: CtViagemRascunho;
  indice: number;
  ativos: CtAtivoMobilizavel[];
  problemas: string[];
  somenteLeitura: boolean;
  selecionado: boolean;
  /** Rótulo do motorista/transportador/recebedor já resolvido pelos cadastros. */
  motoristaLabel: string | null;
  veiculoLabel: string | null;
  recebedorLabel: string | null;
  origemCc: CcGeoInfo | null;
  destinoCc: CcGeoInfo | null;
  /** Estado material vindo do servidor (rascunho salvo / programada). */
  estadoPersistencia: "nao-salvo" | "persistido" | "programado";
  concluido: boolean;
  onFocar: () => void;
  onPatch: (patch: Partial<CtViagemRascunho>) => void;
  onRemover: () => void;
  onDuplicar: () => void;
  onRemoverAtivo: (atendimentoId: string) => void;
  onLimparMotorista: () => void;
  onLimparVeiculo: () => void;
  onLimparRecebedor: () => void;
  onVerRota: () => void;
  onDetalhes: () => void;
  /** Abre o Dialog central "Dados da entrega". */
  onAlterarEntrega: () => void;
  onConcluir: () => void;
}

const BORDA = {
  PRONTO: "border-emerald-600/60",
  INCOMPLETO: "border-amber-500/60",
  CONFLITO: "border-destructive/70",
} as const;

/** Slot compacto com estado vazio (dropzone) ou chip removível. */
const SlotRecurso: React.FC<{
  refDrop: (el: HTMLElement | null) => void;
  isOver: boolean;
  icone: React.ReactNode;
  titulo: string;
  valor: string | null;
  vazioTexto: string;
  testId: string;
  somenteLeitura: boolean;
  onLimpar: () => void;
}> = ({
  refDrop,
  isOver,
  icone,
  titulo,
  valor,
  vazioTexto,
  testId,
  somenteLeitura,
  onLimpar,
}) => (
  <div className="space-y-0.5">
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</p>
    <div
      ref={refDrop}
      data-testid={testId}
      data-preenchido={valor ? "1" : "0"}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm transition-colors",
        !valor && "border-dashed",
        isOver && "border-emerald-600 bg-emerald-600/10",
      )}
    >
      {icone}
      <span className={cn("min-w-0 flex-1 truncate", !valor && "text-xs text-muted-foreground")}>
        {valor ?? vazioTexto}
      </span>
      {valor && !somenteLeitura && (
        <button
          type="button"
          aria-label={`Remover ${titulo.toLowerCase()}`}
          data-testid={`${testId}-limpar`}
          onClick={(e) => {
            e.stopPropagation();
            onLimpar();
          }}
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  </div>
);

export const ViagemBuilderCard: React.FC<ViagemBuilderCardProps> = ({
  viagem,
  indice,
  ativos,
  problemas,
  somenteLeitura,
  selecionado,
  motoristaLabel,
  veiculoLabel,
  recebedorLabel,
  origemCc,
  destinoCc,
  estadoPersistencia,
  concluido,
  onFocar,
  onPatch,
  onRemover,
  onDuplicar,
  onRemoverAtivo,
  onLimparMotorista,
  onLimparVeiculo,
  onLimparRecebedor,
  onVerRota,
  onDetalhes,
  onAlterarEntrega,
  onConcluir,
}) => {
  const veredito = vereditoCard(viagem, ativos, problemas);
  const origem = origemDoAgrupamento(viagem, ativos);
  const transportado = viagem.modalidade === "TRANSPORTADO";

  const viagemDrop = useDroppable({
    id: dropId({ tipo: "VIAGEM", chaveLocal: viagem.chaveLocal }),
    disabled: somenteLeitura,
  });
  const cargaDrop = useDroppable({
    id: dropId({ tipo: "CARGA", chaveLocal: viagem.chaveLocal }),
    disabled: somenteLeitura,
  });
  const motoristaDrop = useDroppable({
    id: dropId({ tipo: "MOTORISTA_SLOT", chaveLocal: viagem.chaveLocal }),
    disabled: somenteLeitura,
  });
  const transportadorDrop = useDroppable({
    id: dropId({ tipo: "TRANSPORTADOR_SLOT", chaveLocal: viagem.chaveLocal }),
    disabled: somenteLeitura,
  });
  const recebedorDrop = useDroppable({
    id: dropId({ tipo: "RECEBEDOR_SLOT", chaveLocal: viagem.chaveLocal }),
    disabled: somenteLeitura,
  });

  const carga = viagem.atendimentoIds
    .map((at) => ativos.find((a) => a.atendimentoId === at))
    .filter((a): a is CtAtivoMobilizavel => !!a);

  const recebedorTexto =
    recebedorLabel ?? (viagem.recebedorPrevistoNome.trim() || null);

  /** Bloco de carga reutilizado nas duas modalidades (rodante/embarcado). */
  const blocoCarga = (
    <div
      ref={cargaDrop.setNodeRef}
      data-testid={`ct6-carga-${viagem.chaveLocal}`}
      className={cn(
        "rounded-md border border-dashed p-2.5",
        cargaDrop.isOver && "border-emerald-600 bg-emerald-600/5",
      )}
    >
      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {transportado
          ? `Carga ${carga.length}/${CT_BUILDER_MAX_CARGA}`
          : `Ativo ${carga.length}/1`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {carga.map((a) => (
          <span
            key={a.atendimentoId}
            className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-xs"
            data-testid={`ct6-carga-item-${a.atendimentoId}`}
          >
            {rotuloAtivo(a)}
            {!somenteLeitura && (
              <button
                type="button"
                aria-label={`Retirar ${rotuloAtivo(a)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoverAtivo(a.atendimentoId);
                }}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </span>
        ))}
        {carga.length === 0 && (
          <span className="text-xs text-muted-foreground">
            Arraste um ativo da coluna esquerda.
          </span>
        )}
      </div>
      {transportado && carga.length > 1 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Capacidade técnica não confirmada — o cadastro não informa peso/capacidade.
        </p>
      )}
    </div>
  );




  return (
    <Card
      ref={viagemDrop.setNodeRef}
      data-testid={`ct6-viagem-${viagem.chaveLocal}`}
      data-estado={veredito.estado}
      data-persistencia={estadoPersistencia}
      data-modalidade={viagem.modalidade ?? ""}
      onClick={onFocar}
      className={cn(
        "mx-auto w-full max-w-none border-l-2 transition-colors",
        BORDA[veredito.estado],
        selecionado && "ring-1 ring-primary/40",
        viagemDrop.isOver && "border-dashed border-emerald-600 bg-emerald-600/5",
      )}
    >

      <CardContent className="space-y-2.5 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {viagem.codigo ?? `Viagem ${indice + 1}`}
          </span>
          <Badge variant="secondary" className="text-xs">
            {viagem.modalidade === "RODANTE"
              ? "Rodando"
              : transportado
                ? "Embarcado"
                : "Modalidade a definir"}
          </Badge>
          {estadoPersistencia !== "nao-salvo" && (
            <Badge
              variant="outline"
              className="border-emerald-600/50 bg-emerald-600/10 text-xs"
            >
              {estadoPersistencia === "programado" ? "Programada" : "Salva no rascunho"}
            </Badge>
          )}
          {concluido && (
            <Badge variant="outline" className="gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Agrupamento concluído
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              data-testid={`ct6-ver-rota-${viagem.chaveLocal}`}
              onClick={(e) => {
                e.stopPropagation();
                onVerRota();
              }}
            >
              <Route className="h-3.5 w-3.5" /> Ver rota
            </Button>
            {!somenteLeitura && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label="Detalhes avançados"
                  data-testid={`ct6-detalhes-${viagem.chaveLocal}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetalhes();
                  }}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label="Duplicar viagem"
                  data-testid={`ct6-duplicar-${viagem.chaveLocal}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicar();
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label="Remover viagem"
                  data-testid={`ct6-remover-${viagem.chaveLocal}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemover();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Linha 1 — quem executa | o que vai (rodante: motorista + ativo) */}
        <div className="grid gap-2.5 md:grid-cols-2">
          {/* Transportador (somente embarcado) */}
          {transportado && (
            <SlotRecurso
              refDrop={transportadorDrop.setNodeRef}
              isOver={transportadorDrop.isOver}
              icone={<Truck className="h-4 w-4 shrink-0 text-muted-foreground" />}
              titulo="Transportador"
              valor={veiculoLabel}
              vazioTexto={
                viagem.tipoTransporte === "TERCEIRO"
                  ? "Transportadora de terceiro — informe nos detalhes"
                  : "Arraste um transportador aqui"
              }
              testId={`ct6-transportador-slot-${viagem.chaveLocal}`}
              somenteLeitura={somenteLeitura}
              onLimpar={onLimparVeiculo}
            />
          )}

          {/* Motorista — quem EXECUTA o transporte */}
          <SlotRecurso
            refDrop={motoristaDrop.setNodeRef}
            isOver={motoristaDrop.isOver}
            icone={<User className="h-4 w-4 shrink-0 text-muted-foreground" />}
            titulo="Motorista"
            valor={motoristaLabel ?? (viagem.motoristaNome.trim() || null)}
            vazioTexto="Arraste o motorista aqui"
            testId={`ct6-motorista-slot-${viagem.chaveLocal}`}
            somenteLeitura={somenteLeitura}
            onLimpar={onLimparMotorista}
          />

          {/* Carga — ao lado do motorista no rodante */}
          {!transportado && blocoCarga}
        </div>

        {/* Carga em largura total no embarcado */}
        {transportado && blocoCarga}

        {/* Linha 2 — Data | Entrega */}
        <div className="grid gap-2.5 md:grid-cols-2">
          {/* Data única (não existe "saída prevista" separada) */}
          <div className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Data da mobilização
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  disabled={somenteLeitura}
                  className="h-8 w-[9.5rem] text-sm"
                  data-testid={`ct6-data-${viagem.chaveLocal}`}
                  value={viagem.dataProgramada}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onPatch(patchDataUnica(e.target.value))}
                />
              </label>
              <span className="text-xs text-muted-foreground">
                Origem:{" "}
                {origem.divergente ? `${origem.quantidade} origens` : origemCc?.codigo ?? "—"}
              </span>
              {viagem.distanciaRotaKm !== null && (
                <span className="text-xs text-muted-foreground">
                  {viagem.distanciaRotaKm} km
                  {viagem.duracaoRotaMin !== null ? ` · ${viagem.duracaoRotaMin} min` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Entrega — resumo do CC destino + ação para o Dialog central */}
          <div className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Entrega</p>
            <div
              className="flex items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5"
              data-testid={`ct6-destino-${viagem.chaveLocal}`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rotuloCc(destinoCc)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {viagem.destinoPontoExato.trim() ||
                    destinoCc?.endereco ||
                    "Endereço do destino não cadastrado"}
                </p>
              </div>
              {!somenteLeitura && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-xs"
                  data-testid={`ct6-alterar-entrega-${viagem.chaveLocal}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAlterarEntrega();
                  }}
                >
                  Alterar entrega
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Recebedor da VIAGEM — quem RECEBE no destino (um por viagem) */}
        <SlotRecurso
          refDrop={recebedorDrop.setNodeRef}
          isOver={recebedorDrop.isOver}
          icone={<Users className="h-4 w-4 shrink-0 text-muted-foreground" />}
          titulo="Recebedor"
          valor={recebedorTexto}
          vazioTexto="Arraste o recebedor aqui"
          testId={`ct6-recebedor-slot-${viagem.chaveLocal}`}
          somenteLeitura={somenteLeitura}
          onLimpar={onLimparRecebedor}
        />


        {/* Veredito visual */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              veredito.estado === "PRONTO"
                ? "text-emerald-700 dark:text-emerald-400"
                : veredito.estado === "CONFLITO"
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-400",
            )}
            data-testid={`ct6-veredito-${viagem.chaveLocal}`}
          >
            {veredito.estado === "PRONTO" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {veredito.estado === "PRONTO" ? "Pronto para revisão" : veredito.mensagem}
          </span>
          {!somenteLeitura && veredito.estado === "PRONTO" && !concluido && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              data-testid={`ct6-concluir-${viagem.chaveLocal}`}
              onClick={(e) => {
                e.stopPropagation();
                onConcluir();
              }}
            >
              Concluir agrupamento
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ViagemBuilderCard;
