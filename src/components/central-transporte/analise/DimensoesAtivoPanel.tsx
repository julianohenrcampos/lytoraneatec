/**
 * CT-3B — Painel das dimensões independentes do ativo selecionado.
 *
 * Nunca colapsa dimensões: Situação Cadastral, Disponibilidade Operacional,
 * Situação na Central e Estado Efetivo são exibidos separadamente, exatamente
 * como devolvidos pelo servidor (fn_ct_estado_efetivo_lote / análise CT-1).
 *
 * CT-2.4: o rótulo ambíguo "Compromisso atual" passa a ser "Situação na
 * Central", que contempla compromisso vigente E futuro. A condição operacional
 * e o estado efetivo legado permanecem intactos.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CtCandidateSelection } from "@/types/centralTransporteCT2";
import type { CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";
import {
  badgeDoEstadoEfetivo,
  textoProximaReserva,
  CLASSE_TOM,
} from "@/utils/central-transporte/estadoEfetivoBadges";
import {
  AVISO_MOBILIZACAO_DERIVADA,
  LABEL_MOBILIZACAO_DERIVADA,
  LABEL_SITUACAO_NA_CENTRAL,
  situacaoMobilizacaoDerivada,
  situacaoNaCentral,
  textoAgendaNaCentral,
} from "@/utils/central-transporte/situacaoNaCentral";
import {
  AVISO_VIGENCIA_FUTURA,
  LABEL_PREVISAO_LIBERACAO,
  rotuloDataInicio,
} from "@/utils/central-transporte/disponibilidadeTemporal";
import { textoAgendaAtivo } from "@/utils/central-transporte/agendaAtivo";




interface Props {
  candidato: CtCandidateSelection;
  estado: CtEstadoEfetivoAtivo | null | undefined;
}

const Dimensao: React.FC<{
  titulo: string;
  testId: string;
  children: React.ReactNode;
  detalhe?: string | null;
}> = ({ titulo, testId, children, detalhe }) => (
  <div className="min-w-0 space-y-1" data-testid={testId}>
    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
      {titulo}
    </span>
    {children}
    {detalhe && <p className="text-[10px] leading-tight text-muted-foreground">{detalhe}</p>}
  </div>
);

export const DimensoesAtivoPanel: React.FC<Props> = ({ candidato, estado }) => {
  const consultado = !!estado;
  // CT-2.4 — apresentação da Central (vigente ou futuro) + mobilização derivada.
  const central = situacaoNaCentral(estado ?? null);
  const mobilizacao = situacaoMobilizacaoDerivada(estado ?? null);
  const efetivo = badgeDoEstadoEfetivo(estado ?? null);
  const proxima = textoProximaReserva(estado ?? null);
  const identificacao =
    [candidato.frota, candidato.numeroFrota].filter(Boolean).join(" ") ||
    candidato.placa ||
    candidato.equipamentoId;

  // CT-3B.1 — rótulos temporais com campos separados (vigência × previsão).
  const { label: labelVigencia, vigenciaFutura } = rotuloDataInicio(
    candidato.disponibilidadeStatus,
    candidato.dataInicioDisponibilidade,
  );
  const detalheOperacional = candidato.precisaRegularizarDisponibilidade
    ? "Sem registro operacional — bloqueio do servidor."
    : [
        candidato.dataInicioDisponibilidade
          ? `${labelVigencia}: ${candidato.dataInicioDisponibilidade}.`
          : null,
        candidato.previsaoLiberacao
          ? `${LABEL_PREVISAO_LIBERACAO}: ${candidato.previsaoLiberacao}.`
          : null,
        vigenciaFutura ? AVISO_VIGENCIA_FUTURA : null,
      ]
        .filter(Boolean)
        .join(" ") || null;

  return (
    <Card data-testid="ct3b-dimensoes-ativo">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{identificacao}</span>
          {candidato.placa && (
            <Badge variant="outline" className="text-[10px]">
              {candidato.placa}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {candidato.centroCustoLabel || "Sem centro de custo atual"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dimensao titulo="Situação cadastral" testId="ct3b-dim-cadastral">
            <Badge variant="outline" className="text-[10px]">
              {candidato.origem}
            </Badge>
          </Dimensao>

          <Dimensao
            titulo="Disponibilidade operacional"
            testId="ct3b-dim-operacional"
            detalhe={detalheOperacional}
          >
            <Badge
              className={`text-[10px] ${
                candidato.precisaRegularizarDisponibilidade
                  ? CLASSE_TOM.bloqueado
                  : CLASSE_TOM.neutro
              }`}
            >
              {candidato.precisaRegularizarDisponibilidade
                ? "Sem status"
                : candidato.disponibilidadeStatus}
            </Badge>
          </Dimensao>

          {/* CT-2.4 — "Situação na Central": contempla reserva vigente E futura. */}
          <Dimensao
            titulo={LABEL_SITUACAO_NA_CENTRAL}
            testId="ct3b-dim-compromisso"
            detalhe={consultado ? central.complemento || proxima : null}
          >
            <div className="flex flex-wrap items-center gap-1">
              <Badge className={`text-[10px] ${CLASSE_TOM[consultado ? central.tom : "bloqueado"]}`}>
                {consultado ? central.label : "NÃO CONSULTADO"}
              </Badge>
              {consultado && mobilizacao && (
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  title={AVISO_MOBILIZACAO_DERIVADA}
                  data-testid="ct24-mobilizacao-derivada"
                >
                  {LABEL_MOBILIZACAO_DERIVADA}
                </Badge>
              )}
            </div>
          </Dimensao>


          <Dimensao
            titulo="Estado efetivo"
            testId="ct3b-dim-estado-efetivo"
            detalhe={consultado ? efetivo.detalhe : null}
          >
            <Badge className={`text-[10px] ${CLASSE_TOM[consultado ? efetivo.tom : "bloqueado"]}`}>
              {consultado ? efetivo.label : "NÃO CONSULTADO"}
            </Badge>
          </Dimensao>
        </div>

        {/* CT-2.3/2.4 — agenda consolidada no servidor, enunciada na linguagem da Central. */}
        <div className="min-w-0 space-y-1" data-testid="ct23-agenda-ativo">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Agenda de utilização
          </span>
          <p className="text-xs leading-tight text-muted-foreground">
            {textoAgendaNaCentral(estado ?? null) ?? textoAgendaAtivo(estado ?? null)}
          </p>
        </div>


      </CardContent>
    </Card>
  );
};


export default DimensoesAtivoPanel;
