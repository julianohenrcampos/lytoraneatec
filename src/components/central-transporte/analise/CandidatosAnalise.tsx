/**
 * CT-3B — Componentes de análise/candidatos extraídos do AnaliseOperacionalSheet.
 *
 * Fonte única compartilhada entre o modal legado (CT-2) e a página dedicada da
 * solicitação (CT-3B). Nenhuma regra nova: apenas apresentação.
 */
import React, { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Info, Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import {
  filtrarAtivosPorBusca,
  AnaliseOperacional,
  AtivoAnalise,
} from "@/services/centralTransporteService";
import {
  ALERTA_CONFLITO_ATENDIMENTO,
  SEM_CENTRO_CUSTO_LABEL,
} from "@/lib/ativos/reconciliacaoOperacional";
import { formatDateBR } from "@/utils/formatDateBR";
import type { CtCandidateOrigem } from "@/types/centralTransporteCT2";
import type {
  CtEstadoConsultaStatus,
  CtEstadoEfetivoMap,
} from "@/types/centralTransporteEstadoEfetivo";
import {
  badgeDoEstadoEfetivo,
  textoProximaReserva,
  CLASSE_TOM,
} from "@/utils/central-transporte/estadoEfetivoBadges";
import {
  FILTRO_ESTADO_LABELS,
  FILTROS_ESTADO_ORDEM,
  filtrarPorEstado,
  type FiltroEstadoAtivo,
} from "@/utils/central-transporte/filtrosEstadoAtivo";
import { rotuloDataInicio } from "@/utils/central-transporte/disponibilidadeTemporal";
import { ariaLabelCandidato } from "@/utils/central-transporte/selecaoProgressiva";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agruparCandidatosPorDepartamento } from "@/utils/central-transporte/agruparCandidatosPorDepartamento";


export const MetaField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[10px] uppercase tracking-wide">{label}</span>
    <span className="text-foreground text-xs truncate">{value}</span>
  </div>
);

export interface AnaliseBodyProps {
  analise: AnaliseOperacional;
  onRetry: () => void;
  selectedId?: string | null;
  onSelect?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  estados?: CtEstadoEfetivoMap;
  /** CT-3B.1 — status global da consulta de compromisso (fail-closed). */
  estadoStatus?: CtEstadoConsultaStatus;
  /** CT-2.2 — detalhe do erro do servidor, exibido para diagnóstico. */
  estadoErro?: { code: string | null; message: string | null; hint: string | null } | null;
  onRetryEstados?: () => void;
  /** Direcionamento preferencial da solicitação (bd_departamentos.id) — null = avaliar. */
  departamentoPreferencialId?: string | null;
  departamentoPreferencialNome?: string | null;
}

export const AnaliseBody: React.FC<AnaliseBodyProps> = ({
  analise,
  onRetry,
  selectedId = null,
  onSelect,
  estados,
  estadoStatus,
  estadoErro = null,
  onRetryEstados,
  departamentoPreferencialId = null,
  departamentoPreferencialNome = null,
}) => {
  // Busca global aplicada a TODAS as abas, sobre o conjunto já carregado.
  // Não recorta o universo de candidatos — apenas a exibição.
  const [busca, setBusca] = useState("");
  // Filtro de estado: opera sobre o conjunto COMPATÍVEL carregado, nunca sobre
  // o parque total de ativos (ver gap documentado no CT-3B.1).
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoAtivo>("TODOS");

  const aplicar = (rows: AtivoAnalise[]): AtivoAnalise[] =>
    filtrarPorEstado(filtrarAtivosPorBusca(rows, busca), filtroEstado, estados);

  const totais = useMemo(
    () => ({
      propria: analise.disponibilidadePropria.length,
      grupo: analise.disponibilidadeGrupo.length,
      previsao: analise.equipamentosComPrevisao.length,
      externoLocado: analise.externoLocado.length,
      naoClassificado: (analise.naoClassificado ?? []).length,
    }),
    [analise],
  );

  const listas = useMemo(
    () => ({
      propria: aplicar(analise.disponibilidadePropria),
      grupo: aplicar(analise.disponibilidadeGrupo),
      previsao: aplicar(analise.equipamentosComPrevisao),
      externoLocado: aplicar(analise.externoLocado),
      naoClassificado: aplicar(analise.naoClassificado ?? []),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analise, busca, filtroEstado, estados],
  );

  const totalCompativel =
    totais.propria + totais.grupo + totais.previsao + totais.externoLocado + totais.naoClassificado;
  const totalExibido =
    listas.propria.length +
    listas.grupo.length +
    listas.previsao.length +
    listas.externoLocado.length +
    listas.naoClassificado.length;


  if (analise.status === "erro_consulta") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro ao consultar</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span className="text-xs">{analise.errorMessage || "Falha ao consultar dados."}</span>
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "acesso_negado") {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Acesso negado</AlertTitle>
        <AlertDescription className="text-xs">
          Você não tem permissão para consultar esta informação. Solicite acesso ao administrador.
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "item_sem_classificacao") {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Item sem classificação</AlertTitle>
        <AlertDescription className="text-xs">
          O item não possui subcategoria, catálogo, variação ou tipo de equipamento. Sem esses dados, a Central não pode identificar ativos compatíveis.
        </AlertDescription>
      </Alert>
    );
  }
  if (analise.status === "sem_ativos_cadastrados") {
    return (
      <>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Sem ativos compatíveis cadastrados</AlertTitle>
          <AlertDescription className="text-xs">
            Nenhum equipamento do inventário próprio, grupo ou locado corresponde a este item.
            {analise.portfolioExterno.length > 0 && " Consulte os fornecedores externos abaixo."}
          </AlertDescription>
        </Alert>
        {analise.portfolioExterno.length > 0 && <PortfolioTable rows={analise.portfolioExterno} />}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {analise.resumo.compatibilidade === "PARCIAL" && (
        <Alert className="py-2">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {analise.resumo.motivo_compatibilidade ||
              "Compatibilidade parcial — capacidade dos ativos não confirmada."}{" "}
            Ver detalhamento na aba Resumo.
          </AlertDescription>
        </Alert>
      )}

      {!analise.localizacao_disponivel && (
        <Alert className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Localização atual indisponível no momento — a análise dos ativos continua válida,
            mas o Centro de Custo atual não pôde ser consultado.
          </AlertDescription>
        </Alert>
      )}

      {/* CT-3B.1 — banner ÚNICO de estado não consultado (fail-closed). */}
      {estadoStatus === "CARREGANDO" && (
        <Alert className="py-2" data-testid="ct3b1-banner-estado-carregando">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="text-xs">
            Consultando o compromisso dos ativos — as operações ficam bloqueadas até a confirmação.
          </AlertDescription>
        </Alert>
      )}

      {estadoStatus === "ERRO" && (
        <Alert variant="destructive" className="py-2" data-testid="ct3b1-banner-estado-nao-consultado">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>
              Não foi possível confirmar o compromisso dos ativos. As operações estão
              temporariamente bloqueadas.
              {(estadoErro?.code || estadoErro?.message) && (
                <span className="ml-1 font-mono" data-testid="ct22-erro-estado-codigo">
                  ({estadoErro?.code ? `${estadoErro.code} — ` : ""}
                  {estadoErro?.message})
                </span>
              )}
              {estadoErro?.hint && <span className="ml-1">{estadoErro.hint}</span>}
            </span>
            {onRetryEstados && (
              <Button size="sm" variant="outline" onClick={onRetryEstados} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-xs"
            data-testid="ct1-busca-ativos"
            placeholder="Buscar em todas as abas por frota, nº de frota, placa, empresa ou centro de custo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select
          value={filtroEstado}
          onValueChange={(v) => setFiltroEstado(v as FiltroEstadoAtivo)}
        >
          <SelectTrigger className="h-9 w-full text-xs sm:w-[260px]" data-testid="ct3b1-filtro-estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS_ESTADO_ORDEM.map((f) => (
              <SelectItem key={f} value={f} className="text-xs">
                {FILTRO_ESTADO_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Escopo honesto do universo: conjunto compatível carregado, não o parque total. */}
      <p className="text-[11px] text-muted-foreground" data-testid="ct3b1-contador-universo">
        Exibindo {totalExibido} de {totalCompativel} ativo(s) compatível(is) carregado(s) para este
        item.
      </p>

      <Tabs defaultValue="propria">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="propria" className="text-xs">
            Própria ({listas.propria.length}/{totais.propria})
          </TabsTrigger>
          <TabsTrigger value="grupo" className="text-xs">
            Grupo ({listas.grupo.length}/{totais.grupo})
          </TabsTrigger>
          <TabsTrigger value="previsao" className="text-xs">
            Previsão ({listas.previsao.length}/{totais.previsao})
          </TabsTrigger>
          <TabsTrigger value="externo" className="text-xs">
            Externo ({listas.externoLocado.length + analise.portfolioExterno.length})
          </TabsTrigger>
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
        </TabsList>


        <TabsContent value="propria">
          <CandidatosAgrupados departamentoPreferencialId={departamentoPreferencialId} departamentoPreferencialNome={departamentoPreferencialNome} rows={listas.propria} empty={busca ? "Nenhum ativo próprio corresponde à busca." : "Nenhum equipamento próprio cadastrado para este item."} origem="PROPRIA" selectedId={selectedId} onSelect={onSelect} estados={estados} />
        </TabsContent>
        <TabsContent value="grupo">
          <CandidatosAgrupados departamentoPreferencialId={departamentoPreferencialId} departamentoPreferencialNome={departamentoPreferencialNome} rows={listas.grupo} empty={busca ? "Nenhum ativo do grupo corresponde à busca." : "Nenhum equipamento do grupo cadastrado para este item."} origem="GRUPO" selectedId={selectedId} onSelect={onSelect} estados={estados} />
        </TabsContent>
        <TabsContent value="previsao">
          <PrevisaoTable rows={listas.previsao} selectedId={selectedId} onSelect={onSelect} estados={estados} />
        </TabsContent>
        <TabsContent value="externo" className="space-y-4">
          {listas.externoLocado.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Ativos locados cadastrados
              </h4>
              <AtivosTable rows={listas.externoLocado} empty="—" estados={estados} />
            </div>
          )}
          {analise.portfolioExterno.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Fornecedores do portfólio
              </h4>
              <PortfolioTable rows={analise.portfolioExterno} />
            </div>
          )}
          {listas.externoLocado.length === 0 && analise.portfolioExterno.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-6">
              Nenhum ativo locado nem fornecedor externo compatível.
            </div>
          )}
        </TabsContent>
        <TabsContent value="resumo" className="space-y-4">
          <ResumoBox analise={analise} />
          {listas.naoClassificado.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Ativos sem propriedade classificada ({listas.naoClassificado.length})
              </h4>
              <AtivosTable rows={listas.naoClassificado} empty="—" estados={estados} />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {analise.status === "sem_disponibilidade" && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Sem disponibilidade confirmada no momento</AlertTitle>
          <AlertDescription className="text-xs">
            Existem {analise.totalCandidatos} ativo(s) cadastrado(s) compatível(is), mas nenhum consta como
            DISPONÍVEL agora e nenhum tem previsão de liberação.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

};

const propriedadeBadge = (p: AtivoAnalise["propriedade"]) => {
  const map: Record<string, string> = {
    PROPRIA: "bg-emerald-100 text-emerald-800",
    GRUPO: "bg-blue-100 text-blue-800",
    LOCADO: "bg-amber-100 text-amber-800",
    NAO_CLASSIFICADO: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[p] || ""}`}>{p.replace("_", " ")}</Badge>;
};

/** CC atual — exclusivamente da projeção autoritativa (fn_veiculos_alocacao_atual). */
const ccLabel = (r: AtivoAnalise): string => {
  if (!r.centro_custo_nome && !r.centro_custo_codigo) return SEM_CENTRO_CUSTO_LABEL;
  return [r.centro_custo_codigo, r.centro_custo_nome].filter(Boolean).join(" — ");
};

/** Célula de CC: ausência é sinalizada explicitamente, nunca ocultada. */
const CcCell: React.FC<{ r: AtivoAnalise }> = ({ r }) => (
  <div className="flex flex-col gap-0.5">
    {r.possui_centro_custo_atual ? (
      <span className="text-xs">{ccLabel(r)}</span>
    ) : (
      <span className="text-xs italic text-muted-foreground">{SEM_CENTRO_CUSTO_LABEL}</span>
    )}
    {r.ja_no_centro_custo_destino && (
      <Badge variant="outline" className="w-fit text-[10px] bg-emerald-100 text-emerald-800">
        Já no destino
      </Badge>
    )}
  </div>
);

/** Compatibilidade com motivo detalhado (ex.: unidade de capacidade ausente). */
const CompatCell: React.FC<{ r: AtivoAnalise }> = ({ r }) => {
  const badge = (
    <Badge variant="outline" className="text-[10px]">
      {r.compatibilidade}
    </Badge>
  );
  if (!r.motivo_compatibilidade) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild><span>{badge}</span></TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{r.motivo_compatibilidade}</TooltipContent>
    </Tooltip>
  );
};

/** Alerta de conflito cadastral — informa, nunca esconde nem bloqueia sozinho. */
const ConflitoIcon: React.FC<{ r: AtivoAnalise }> = ({ r }) => {
  if (!r.conflito_cadastral) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-600" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        {r.conflito_cadastral_motivo} {ALERTA_CONFLITO_ATENDIMENTO}
      </TooltipContent>
    </Tooltip>
  );
};

const statusBadge = (s: AtivoAnalise["status_operacional"]) => {
  if (s === "SEM_STATUS") return <span className="text-xs text-muted-foreground">SEM STATUS</span>;
  const map: Record<string, string> = {
    DISPONIVEL: "bg-emerald-600 text-primary-foreground",
    ALOCADO: "bg-blue-600 text-primary-foreground",
    MANUTENCAO: "bg-amber-600 text-primary-foreground",
    INDISPONIVEL: "bg-destructive text-destructive-foreground",
    DESCONHECIDO: "bg-muted text-muted-foreground",
  };
  return <Badge className={`text-[10px] ${map[s] || ""}`}>{s}</Badge>;
};


/** CT-2.2 — Coluna de compromisso: nunca exibe ativo reservado como livre. */
export const CompromissoCell: React.FC<{ estado?: CtEstadoEfetivoMap; id: string }> = ({ estado, id }) => {
  const info = estado?.get(id);
  if (!info) return <span className="text-xs text-muted-foreground">—</span>;
  const badge = badgeDoEstadoEfetivo(info);
  const proxText = textoProximaReserva(info);
  const conteudo = (
    <div className="flex flex-col gap-0.5 items-start">
      <Badge className={`text-[10px] ${CLASSE_TOM[badge.tom]}`}>{badge.label}</Badge>
      {proxText && (
        <span className="text-[10px] text-muted-foreground leading-tight">{proxText}</span>
      )}
    </div>
  );
  if (!badge.detalhe) return conteudo;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{conteudo}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{badge.detalhe}</TooltipContent>
    </Tooltip>
  );
};

/**
 * CT-3B.1 — Vigência do status operacional (data_inicio), com rótulo próprio.
 * Apresentação apenas: o servidor ainda não aplica data_inicio na autorização.
 */
const VigenciaHint: React.FC<{ r: AtivoAnalise }> = ({ r }) => {
  const dataInicio = r.data_inicio_disponibilidade;
  if (!dataInicio) return null;
  const { label, vigenciaFutura } = rotuloDataInicio(r.status_operacional, dataInicio);
  return (
    <span
      className={`mt-0.5 block text-[10px] leading-tight ${
        vigenciaFutura ? "text-amber-700" : "text-muted-foreground"
      }`}
      data-testid={`ct3b1-vigencia-${r.equipamento_id}`}
    >
      {label} {formatDateBR(dataInicio)}
    </span>
  );
};

interface AtivosTableProps {
  rows: AtivoAnalise[];
  empty: string;
  origem?: CtCandidateOrigem;
  selectedId?: string | null;
  onSelect?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  estados?: CtEstadoEfetivoMap;
}

/**
 * CT-3B.2 — Radio de seleção do candidato.
 * Seleção apenas contextual no frontend: não cria atendimento nem reserva.
 */
const SelecaoRadio: React.FC<{
  checked: boolean;
  grupo: string;
  ativo: AtivoAnalise;
  estados?: CtEstadoEfetivoMap;
  onSelect: () => void;
}> = ({ checked, grupo, ativo, estados, onSelect }) => (
  <input
    type="radio"
    name={grupo}
    checked={checked}
    onChange={onSelect}
    onClick={(e) => e.stopPropagation()}
    data-testid={`ct3b2-radio-${ativo.equipamento_id}`}
    aria-label={ariaLabelCandidato({
      frota: ativo.frota,
      numeroFrota: ativo.numero_frota,
      placa: ativo.placa,
      estado: estados?.get(ativo.equipamento_id)
        ? badgeDoEstadoEfetivo(estados.get(ativo.equipamento_id)!).label
        : null,
    })}
    className="h-4 w-4 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  />
);

/** CT-3B.2 — Cards de candidatos no mobile (sem rolagem horizontal). */
const CandidatosCards: React.FC<AtivosTableProps & { grupo: string }> = ({
  rows,
  empty,
  origem,
  selectedId = null,
  onSelect,
  estados,
  grupo,
}) => (
  <div className="space-y-2 md:hidden" data-testid="ct3b2-candidatos-cards">
    {rows.length === 0 ? (
      <p className="py-6 text-center text-xs text-muted-foreground">{empty}</p>
    ) : (
      rows.map((r) => {
        const selecionado = selectedId === r.equipamento_id;
        const selecionar = onSelect && origem ? () => onSelect(r, origem) : undefined;
        return (
          <div
            key={r.equipamento_id}
            role={selecionar ? "button" : undefined}
            tabIndex={selecionar ? 0 : undefined}
            onClick={selecionar}
            onKeyDown={
              selecionar
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selecionar();
                    }
                  }
                : undefined
            }
            className={`rounded-md border p-3 text-xs ${
              selecionado ? "border-primary bg-muted/50" : ""
            }`}
          >
            <div className="flex items-start gap-2">
              {selecionar && (
                <SelecaoRadio
                  checked={selecionado}
                  grupo={`${grupo}-mobile`}
                  ativo={r}
                  estados={estados}
                  onSelect={selecionar}
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {[r.frota, r.numero_frota].filter(Boolean).join(" ") || r.placa || "—"}
                  </span>
                  {r.placa && <span className="text-muted-foreground">{r.placa}</span>}
                  {propriedadeBadge(r.propriedade)}
                </div>
                <CcCell r={r} />
                <p className="text-[11px] text-muted-foreground" data-testid={`ct5-dep-card-${r.equipamento_id}`}>
                  Departamento: {r.departamento_nome || "Não informado"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(r.status_operacional)}
                  <CompromissoCell estado={estados} id={r.equipamento_id} />
                  <CompatCell r={r} />
                </div>
              </div>
            </div>
          </div>
        );
      })
    )}
  </div>
);

/**
 * Candidatos agrupados pelo direcionamento preferencial da solicitação.
 * Apresentação apenas: recebe a lista JÁ ordenada pelo matching maduro e
 * somente a particiona. Nenhum candidato é escondido.
 */
export const CandidatosAgrupados: React.FC<
  AtivosTableProps & {
    departamentoPreferencialId?: string | null;
    departamentoPreferencialNome?: string | null;
  }
> = ({ rows, empty, departamentoPreferencialId, departamentoPreferencialNome, ...rest }) => {
  const grupos = React.useMemo(
    () =>
      agruparCandidatosPorDepartamento(
        rows,
        departamentoPreferencialId,
        departamentoPreferencialNome,
      ),
    [rows, departamentoPreferencialId, departamentoPreferencialNome],
  );

  if (rows.length === 0) return <AtivosTable rows={rows} empty={empty} {...rest} />;

  return (
    <div className="space-y-4" data-testid="ct5-candidatos-agrupados">
      {grupos.map((g) => (
        <div key={g.id} data-testid={`ct5-grupo-${g.id.toLowerCase()}`}>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {g.titulo} ({g.candidatos.length})
          </h4>
          <AtivosTable rows={g.candidatos} empty={empty} {...rest} />
        </div>
      ))}
    </div>
  );
};

export const AtivosTable: React.FC<AtivosTableProps> = ({ rows, empty, origem, selectedId = null, onSelect, estados }) => {
  const grupo = React.useId();
  const selecionavel = !!onSelect && !!origem;
  return (
    <>
      <CandidatosCards
        rows={rows}
        empty={empty}
        origem={origem}
        selectedId={selectedId}
        onSelect={onSelect}
        estados={estados}
        grupo={grupo}
      />
      <div className="hidden max-h-[400px] overflow-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {selecionavel && <TableHead className="text-xs w-14">Seleção</TableHead>}
              <TableHead className="text-xs">Frota</TableHead>
              <TableHead className="text-xs">Nº Frota</TableHead>
              <TableHead className="text-xs">Placa</TableHead>
              <TableHead className="text-xs">Empresa</TableHead>
              <TableHead className="text-xs">Departamento</TableHead>
              <TableHead className="text-xs">Propriedade</TableHead>
              <TableHead className="text-xs">Capacidade</TableHead>
              <TableHead className="text-xs">CC atual</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Compromisso</TableHead>
              <TableHead className="text-xs">Compat.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={selecionavel ? 12 : 11} className="text-center text-xs text-muted-foreground py-6">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const selecionado = selectedId === r.equipamento_id;
                const selecionar = onSelect && origem ? () => onSelect(r, origem) : undefined;
                return (
                  <TableRow
                    key={r.equipamento_id}
                    data-state={selecionado ? "selected" : undefined}
                    className={selecionar ? "cursor-pointer" : undefined}
                    onClick={selecionar}
                  >
                    {selecionavel && (
                      <TableCell>
                        <SelecaoRadio
                          checked={selecionado}
                          grupo={grupo}
                          ativo={r}
                          estados={estados}
                          onSelect={selecionar!}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-xs">{r.frota || "—"}</TableCell>
                    <TableCell className="text-xs">{r.numero_frota || "—"}</TableCell>
                    <TableCell className="text-xs">{r.placa || "—"}</TableCell>
                    <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
                    <TableCell className="text-xs" data-testid={`ct5-dep-${r.equipamento_id}`}>
                      {r.departamento_nome || "—"}
                    </TableCell>
                    <TableCell>{propriedadeBadge(r.propriedade)}</TableCell>
                    <TableCell className="text-xs">
                      {r.capacidade_valor != null ? `${r.capacidade_valor} ${r.capacidade_unidade || ""}` : "—"}
                    </TableCell>
                    <TableCell><CcCell r={r} /></TableCell>

                    <TableCell>
                      {statusBadge(r.status_operacional)}
                      <ConflitoIcon r={r} />
                      <VigenciaHint r={r} />
                    </TableCell>
                    <TableCell><CompromissoCell estado={estados} id={r.equipamento_id} /></TableCell>
                    <TableCell><CompatCell r={r} /></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

interface PrevisaoTableProps {
  rows: AtivoAnalise[];
  selectedId?: string | null;
  onSelect?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  estados?: CtEstadoEfetivoMap;
}

const PrevisaoTable: React.FC<PrevisaoTableProps> = ({ rows, selectedId = null, onSelect, estados }) => {
  const grupo = React.useId();
  return (
    <>
      <CandidatosCards
        rows={rows}
        empty="Nenhum equipamento com previsão de liberação."
        origem="PREVISAO"
        selectedId={selectedId}
        onSelect={onSelect}
        estados={estados}
        grupo={grupo}
      />
      <div className="hidden max-h-[400px] overflow-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {!!onSelect && <TableHead className="text-xs w-14">Seleção</TableHead>}
              <TableHead className="text-xs">Frota</TableHead>
              <TableHead className="text-xs">Nº Frota</TableHead>
              <TableHead className="text-xs">Propriedade</TableHead>
              <TableHead className="text-xs">CC atual</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Compromisso</TableHead>
              <TableHead className="text-xs">Previsão</TableHead>
              <TableHead className="text-xs">Confiab.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onSelect ? 9 : 8} className="text-center text-xs text-muted-foreground py-6">
                  Nenhum equipamento com previsão de liberação.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const selecionado = selectedId === r.equipamento_id;
                const selecionar = onSelect ? () => onSelect(r, "PREVISAO") : undefined;
                return (
                  <TableRow
                    key={r.equipamento_id}
                    data-state={selecionado ? "selected" : undefined}
                    className={selecionar ? "cursor-pointer" : undefined}
                    onClick={selecionar}
                  >
                    {!!onSelect && (
                      <TableCell>
                        <SelecaoRadio
                          checked={selecionado}
                          grupo={grupo}
                          ativo={r}
                          estados={estados}
                          onSelect={selecionar!}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-xs">{r.frota || "—"}</TableCell>
                    <TableCell className="text-xs">{r.numero_frota || "—"}</TableCell>
                    <TableCell>{propriedadeBadge(r.propriedade)}</TableCell>
                    <TableCell><CcCell r={r} /></TableCell>
                    <TableCell>
                      {statusBadge(r.status_operacional)}
                      <ConflitoIcon r={r} />
                    </TableCell>
                    <TableCell><CompromissoCell estado={estados} id={r.equipamento_id} /></TableCell>
                    <TableCell className="text-xs">
                      {r.previsao_liberacao ? formatDateBR(r.previsao_liberacao) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.confiabilidade || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
};


const PortfolioTable: React.FC<{ rows: AnaliseOperacional["portfolioExterno"] }> = ({ rows }) => (
  <div className="rounded-md border overflow-auto max-h-[400px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Empresa</TableHead>
          <TableHead className="text-xs">Variação</TableHead>
          <TableHead className="text-xs">Qtd Estimada</TableHead>
          <TableHead className="text-xs">C/ Operador</TableHead>
          <TableHead className="text-xs">S/ Operador</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
              Nenhum fornecedor externo no portfólio.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{r.empresa || "—"}</TableCell>
              <TableCell className="text-xs">{r.variacao || "—"}</TableCell>
              <TableCell className="text-xs">{r.quantidade_estimada ?? "—"}</TableCell>
              <TableCell className="text-xs">
                {r.valor_com_operador != null ? `R$ ${Number(r.valor_com_operador).toLocaleString("pt-BR")}` : "—"}
              </TableCell>
              <TableCell className="text-xs">
                {r.valor_sem_operador != null ? `R$ ${Number(r.valor_sem_operador).toLocaleString("pt-BR")}` : "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

const ResumoBox: React.FC<{ analise: AnaliseOperacional }> = ({ analise }) => {
  const r = analise.resumo;
  const d = analise.diagnosticoCapacidade;
  const linhas: { k: string; v: string | number }[] = [
    { k: "Quantidade solicitada", v: r.quantidade_solicitada },
    { k: "Total de candidatos cadastrados", v: r.total_candidatos },
    { k: "Próprios cadastrados", v: r.propria_cadastrada },
    { k: "Grupo cadastrados", v: r.grupo_cadastrado },
    { k: "Locados cadastrados", v: r.locado_cadastrado },
    { k: "Não classificados", v: r.nao_classificado },
    { k: "Disponíveis agora", v: r.disponiveis_agora },
    { k: "Sem status operacional", v: r.sem_status },
    { k: "Com previsão de liberação", v: r.com_previsao },
    { k: "Fornecedores compatíveis", v: r.fornecedores_compativeis },
    { k: "Compatibilidade", v: r.compatibilidade },
    { k: "Estratégia de matching", v: analise.matchingUsed },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-md border p-4 space-y-2 bg-muted/30">
        <div className="grid grid-cols-2 gap-2">
          {linhas.map((l) => (
            <div key={l.k} className="flex justify-between text-xs border-b py-1">
              <span className="text-muted-foreground">{l.k}</span>
              <span className="font-medium">{l.v}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground pt-1">
          Reconciliação: {r.total_candidatos} = {r.propria_cadastrada} própria + {r.grupo_cadastrado} grupo +{" "}
          {r.locado_cadastrado} externo + {r.nao_classificado} não classificado
          {analise.reconciliacao_ok ? " ✓" : " ✗"}
        </div>
      </div>

      {d && (
        <div className="rounded-md border p-4 space-y-1 text-xs">
          <h4 className="font-semibold text-muted-foreground uppercase tracking-wide text-[11px]">
            Diagnóstico de capacidade
          </h4>
          <div>{d.candidatos} candidato(s) da estratégia “{analise.matchingUsed}”</div>
          <div>{d.sem_capacidade} sem capacidade cadastrada</div>
          <div>{d.com_valor_sem_unidade} com valor de capacidade e unidade não informada</div>
          <div>
            {d.correspondencia_exata} com correspondência exata
            {d.capacidade_solicitada_valor != null
              ? ` a ${d.capacidade_solicitada_valor}${d.capacidade_solicitada_unidade ? ` ${d.capacidade_solicitada_unidade}` : ""}`
              : ""}
          </div>
        </div>
      )}
    </div>
  );
};

