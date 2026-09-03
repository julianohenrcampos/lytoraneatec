/**
 * Tradutor ÚNICO de eventos de Chamado Interno para apresentação empresarial.
 *
 * Fonte: `bd_chamado_interno_eventos` (tipo + payload). Nenhuma consulta extra
 * é feita aqui — todo o conteúdo vem do snapshot já gravado no payload, o que
 * mantém a timeline em zero N+1.
 *
 * Regra: nenhum componente deve conter `if (acao === ...)`. Toda classificação
 * de `payload.acao` vive neste módulo.
 */
import { CHAMADO_INTERNO_EVENTO_META } from "@/constants/chamadosInternos";
import type { ChamadoInternoEventoTipo } from "@/types/chamadosInternos";

export type EventoVariante = "neutro" | "andamento" | "sucesso" | "alerta" | "erro";
export type EventoIcone =
  | "abertura"
  | "roteamento"
  | "aprovacao"
  | "aprovado"
  | "rejeitado"
  | "pessoa"
  | "planejamento"
  | "transporte"
  | "entrega"
  | "recebimento"
  | "concluido"
  | "cancelado"
  | "mensagem"
  | "generico";

export interface EventoApresentacao {
  titulo: string;
  descricao?: string | null;
  /** Linhas curtas de contexto (etapa, aprovador, viagem, ativos…). */
  metadata: string[];
  icone: EventoIcone;
  variante: EventoVariante;
  badgeClasses: string;
}

export interface EventoOperacionalLike {
  tipo: string;
  mensagem?: string | null;
  payload?: unknown;
  autor_nome?: string | null;
}

const BADGE: Record<EventoVariante, string> = {
  neutro: "bg-muted text-foreground",
  andamento: "bg-primary/10 text-primary",
  sucesso: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  alerta: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  erro: "bg-destructive/15 text-destructive",
};

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Etapa "N de T" a partir de payload direto ou do snapshot de status. */
const etapaLinha = (p: Record<string, unknown>): string | null => {
  const status = asRecord(p.status);
  const atual = asRecord(status.etapa_atual);
  const ordem =
    num(p.etapa) ?? num(atual.ordem) ?? num(p.ordem) ?? null;
  const total = num(p.total_etapas) ?? num(status.total_etapas) ?? null;
  if (ordem && total) return `Etapa ${ordem} de ${total}`;
  if (total) return `${total} etapa(s) de aprovação`;
  if (ordem) return `Etapa ${ordem}`;
  return null;
};

const ORIGEM_LABEL: Record<string, string> = {
  engenheiro_solicitante: "Engenheiro da Solicitação",
  engenheiro_centro_custo: "Engenheiro responsável do Centro de Custo",
  usuario_especifico: "Aprovador designado",
  permissao: "Aprovador por permissão (RBAC)",
};

export const traduzirOrigemAprovador = (origem?: string | null): string | null => {
  if (!origem) return null;
  return ORIGEM_LABEL[origem] ?? origem;
};

/** Lista de ativos, se o payload trouxer snapshot. */
const ativosLinhas = (p: Record<string, unknown>): string[] => {
  const raw = Array.isArray(p.ativos) ? p.ativos : [];
  return raw.slice(0, 8).map((a) => {
    const r = asRecord(a);
    const partes = [
      str(r.codigo) ?? str(r.frota) ?? str(r.equipamento_codigo),
      str(r.descricao) ?? str(r.nome) ?? str(r.equipamento_nome),
      str(r.departamento_nome) ?? str(r.departamento),
    ].filter(Boolean);
    return partes.length ? `• ${partes.join(" — ")}` : "• Ativo";
  });
};

/** Ativo único (payload da CT: frota + numero_frota). */
const ativoLinha = (p: Record<string, unknown>): string | null => {
  const frota = [str(p.frota), str(p.numero_frota)].filter(Boolean).join("-");
  return frota ? `Ativo: ${frota}` : null;
};

const viagemLinha = (p: Record<string, unknown>): string | null => {
  const codigo = str(p.codigo_viagem) ?? str(p.viagem_codigo);
  return codigo ? `Viagem: ${codigo}` : null;
};

const qtdAtivosLinha = (p: Record<string, unknown>): string | null => {
  const qtd = num(p.quantidade_ativos) ?? num(p.total_ativos);
  return qtd ? `Ativos: ${qtd}` : null;
};

/** Data/hora no fuso operacional; aceita ISO ou date. */
const dataLinha = (rotulo: string, valor: unknown): string | null => {
  const iso = str(valor);
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `${rotulo}: ${iso}`;
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return `${rotulo}: ${d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(somenteData ? {} : { hour: "2-digit", minute: "2-digit" }),
  })}`;
};

interface Mapeado {
  titulo: string;
  variante: EventoVariante;
  icone: EventoIcone;
  linhas?: (p: Record<string, unknown>) => (string | null)[];
  descricao?: (p: Record<string, unknown>) => string | null;
}

const ACOES: Record<string, Mapeado> = {
  SOLICITACAO_EQUIPAMENTO_CRIADA: {
    titulo: "Solicitação de Equipamento criada",
    variante: "andamento",
    icone: "abertura",
    linhas: (p) => [
      str(p.referencia_tecnica),
      str(p.departamento_atendimento_preferencial_nome)
        ? `Atendimento preferencial: ${str(p.departamento_atendimento_preferencial_nome)}`
        : null,
    ],
  },
  APROVACAO_SOLICITADA: {
    titulo: "Enviado para aprovação",
    variante: "andamento",
    icone: "aprovacao",
    linhas: (p) => {
      const status = asRecord(p.status);
      const atual = asRecord(status.etapa_atual);
      const fluxo = asRecord(status.fluxo);
      const nome = str(atual.aprovador_nome) ?? str(p.aprovador_nome);
      return [
        nome ? `Aguardando aprovação de: ${nome}` : "Aguardando aprovação",
        etapaLinha(p),
        str(fluxo.nome) ? `Fluxo: ${str(fluxo.nome)}` : null,
        traduzirOrigemAprovador(str(atual.aprovador_origem))
          ? `Origem do aprovador: ${traduzirOrigemAprovador(str(atual.aprovador_origem))}`
          : null,
      ];
    },
  },
  ETAPA_APROVADA: {
    titulo: "Etapa aprovada",
    variante: "sucesso",
    icone: "aprovado",
    linhas: (p) => [
      etapaLinha(p),
      traduzirOrigemAprovador(str(p.aprovador_origem)),
      str(p.observacao) ? `Observação: ${str(p.observacao)}` : null,
    ],
    descricao: (p) =>
      str(p.aprovador_nome) ? `Aprovado por ${str(p.aprovador_nome)}` : null,
  },
  ETAPA_REJEITADA: {
    titulo: "Etapa rejeitada",
    variante: "erro",
    icone: "rejeitado",
    linhas: (p) => [
      etapaLinha(p),
      str(p.motivo) ?? str(p.observacao) ? `Motivo: ${str(p.motivo) ?? str(p.observacao)}` : null,
    ],
    descricao: (p) =>
      str(p.aprovador_nome) ? `Rejeitado por ${str(p.aprovador_nome)}` : null,
  },
  APROVACAO_CONCLUIDA: {
    titulo: "Aprovação concluída",
    variante: "sucesso",
    icone: "concluido",
    linhas: (p) => {
      const total = num(p.total_etapas);
      return [
        total ? `Todas as ${total} etapa(s) foram aprovadas.` : "Aprovação finalizada.",
        "Solicitação disponível para atendimento.",
      ];
    },
  },
  APROVACAO_REJEITADA: {
    titulo: "Solicitação rejeitada",
    variante: "erro",
    icone: "rejeitado",
    linhas: (p) => [
      str(p.aprovador_nome) ? `Rejeitado por: ${str(p.aprovador_nome)}` : null,
      etapaLinha(p),
      str(p.motivo) ? `Motivo: ${str(p.motivo)}` : null,
    ],
  },
  ATENDIMENTO_ASSUMIDO: {
    titulo: "Atendimento assumido",
    variante: "andamento",
    icone: "pessoa",
    linhas: (p) => [str(p.responsavel_nome)],
  },
  ANALISE_DISPONIBILIDADE_INICIADA: {
    titulo: "Análise de disponibilidade iniciada",
    variante: "andamento",
    icone: "planejamento",
  },
  ATIVO_SELECIONADO: {
    titulo: "Ativos definidos para atendimento",
    variante: "andamento",
    icone: "planejamento",
    linhas: (p) => [
      num(p.total_ativos) ? `${num(p.total_ativos)} ativo(s) selecionado(s)` : null,
      ativoLinha(p),
      str(p.departamento_nome) ? `Departamento: ${str(p.departamento_nome)}` : null,
      ...ativosLinhas(p),
    ],
  },
  ATIVO_DEPARTAMENTO_ALTERNATIVO_SELECIONADO: {
    titulo: "Ativo de departamento alternativo definido",
    variante: "alerta",
    icone: "planejamento",
    linhas: (p) => [
      str(p.departamento_nome) ? `Departamento: ${str(p.departamento_nome)}` : null,
      str(p.justificativa) ? `Justificativa: ${str(p.justificativa)}` : null,
      ...ativosLinhas(p),
    ],
  },
  PLANEJAMENTO_RASCUNHO_SALVO: {
    titulo: "Planejamento em elaboração",
    variante: "andamento",
    icone: "planejamento",
    linhas: (p) => [num(p.total_ativos) ? `${num(p.total_ativos)} ativo(s)` : null],
  },
  PLANEJAMENTO_PROGRAMADO: {
    titulo: "Planejamento programado",
    variante: "sucesso",
    icone: "planejamento",
    linhas: (p) => [
      viagemLinha(p),
      qtdAtivosLinha(p),
      str(p.origem_nome) ? `Origem: ${str(p.origem_nome)}` : null,
      str(p.destino_nome) ? `Destino: ${str(p.destino_nome)}` : null,
      dataLinha("Data prevista", p.data_programada ?? p.data_prevista),
    ],
  },
  TRANSPORTE_INICIADO: {
    titulo: "Transporte iniciado",
    variante: "andamento",
    icone: "transporte",
    linhas: (p) => [
      viagemLinha(p),
      str(p.motorista_nome) ? `Motorista: ${str(p.motorista_nome)}` : null,
      dataLinha("Saída", p.data_hora_saida),
      str(p.origem_nome) ? `Origem: ${str(p.origem_nome)}` : null,
      str(p.destino_nome) ? `Destino: ${str(p.destino_nome)}` : null,
    ],
  },
  CHEGADA_DESTINO: {
    titulo: "Chegada ao destino",
    variante: "andamento",
    icone: "entrega",
    linhas: (p) => [
      viagemLinha(p),
      str(p.destino_nome) ? `Destino: ${str(p.destino_nome)}` : null,
      dataLinha("Horário", p.data_hora_chegada),
    ],
  },
  ENTREGA_REALIZADA: {
    titulo: "Entrega realizada",
    variante: "sucesso",
    icone: "entrega",
    linhas: (p) => [
      qtdAtivosLinha(p),
      viagemLinha(p),
      str(p.destino_nome) ? `Destino: ${str(p.destino_nome)}` : null,
      num(p.ressalvas) ? `Ressalvas: ${num(p.ressalvas)}` : null,
      dataLinha("Horário", p.data_hora),
    ],
  },
  RECEBIMENTO_CONFIRMADO: {
    titulo: "Recebimento confirmado",
    variante: "sucesso",
    icone: "recebimento",
    linhas: (p) => [
      str(p.recebedor_nome) ?? str(p.recebido_por_nome)
        ? `Recebido por: ${str(p.recebedor_nome) ?? str(p.recebido_por_nome)}`
        : null,
      viagemLinha(p),
      dataLinha("Data", p.data_hora),
      num(p.recusas) ? `Recusas: ${num(p.recusas)}` : null,
      num(p.ressalvas) ? `Ressalvas: ${num(p.ressalvas)}` : null,
    ],
  },
  SOLICITACAO_ATENDIDA: {
    titulo: "Solicitação de equipamento atendida",
    variante: "sucesso",
    icone: "concluido",
    linhas: (p) => [
      num(p.quantidade_itens) ? `Itens atendidos: ${num(p.quantidade_itens)}` : null,
      num(p.quantidade_ativos) ? `Ativos entregues: ${num(p.quantidade_ativos)}` : null,
      num(p.ativos_entregues) != null && num(p.ativos_total) != null
        ? `Ativos entregues: ${num(p.ativos_entregues)}/${num(p.ativos_total)}`
        : null,
      dataLinha("Conclusão", p.concluido_em),
    ],
  },
  SOLICITACAO_CANCELADA: {
    titulo: "Solicitação cancelada",
    variante: "erro",
    icone: "cancelado",
    linhas: (p) => [str(p.motivo) ? `Motivo: ${str(p.motivo)}` : null],
  },
  PLANEJAMENTO_CANCELADO: {
    titulo: "Planejamento cancelado",
    variante: "erro",
    icone: "cancelado",
    linhas: (p) => [
      str(p.motivo) ? `Motivo: ${str(p.motivo)}` : null,
      dataLinha("Data", p.cancelado_em),
    ],
  },
  COTACAO_NECESSARIA: {
    titulo: "Cotação necessária",
    variante: "alerta",
    icone: "generico",
  },
  COTACAO_EM_ANDAMENTO: {
    titulo: "Cotação em andamento",
    variante: "alerta",
    icone: "generico",
  },
  SEM_DISPONIBILIDADE: {
    titulo: "Sem disponibilidade interna",
    variante: "alerta",
    icone: "generico",
  },
};

const ICONE_POR_TIPO: Partial<Record<ChamadoInternoEventoTipo, EventoIcone>> = {
  abertura: "abertura",
  roteamento: "roteamento",
  atribuicao: "pessoa",
  resposta_atendente: "mensagem",
  resposta_solicitante: "mensagem",
  solicitacao_informacao: "mensagem",
  nota_interna: "mensagem",
  mudanca_status: "generico",
  resolucao: "concluido",
  confirmacao_encerramento: "concluido",
  reabertura: "generico",
  cancelamento: "cancelado",
  evento_operacional: "generico",
};

const VARIANTE_POR_TIPO: Partial<Record<ChamadoInternoEventoTipo, EventoVariante>> = {
  resolucao: "sucesso",
  confirmacao_encerramento: "sucesso",
  reabertura: "alerta",
  cancelamento: "erro",
};

/** Ações operacionais desconhecidas — registra em dev para classificação futura. */
const logDesconhecida = (acao: string) => {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn("[chamados-internos][evento-operacional][acao-nao-mapeada]", acao);
  }
};

export function formatChamadoEvento(evento: EventoOperacionalLike): EventoApresentacao {
  const payload = asRecord(evento.payload);

  if (evento.tipo === "evento_operacional") {
    const acao = str(payload.acao);
    const mapeado = acao ? ACOES[acao] : undefined;

    if (!mapeado) {
      if (acao) logDesconhecida(acao);
      return {
        titulo: "Evento operacional",
        descricao: evento.mensagem ?? null,
        metadata: [],
        icone: "generico",
        variante: "neutro",
        badgeClasses: BADGE.neutro,
      };
    }

    const linhas = (mapeado.linhas?.(payload) ?? []).filter(
      (l): l is string => typeof l === "string" && l.length > 0,
    );
    return {
      titulo: mapeado.titulo,
      descricao: mapeado.descricao?.(payload) ?? evento.mensagem ?? null,
      metadata: linhas,
      icone: mapeado.icone,
      variante: mapeado.variante,
      badgeClasses: BADGE[mapeado.variante],
    };
  }

  const tipo = evento.tipo as ChamadoInternoEventoTipo;
  const meta = CHAMADO_INTERNO_EVENTO_META[tipo];
  const variante = VARIANTE_POR_TIPO[tipo] ?? "neutro";
  return {
    titulo: meta?.label ?? evento.tipo,
    descricao: evento.mensagem ?? null,
    metadata: [],
    icone: ICONE_POR_TIPO[tipo] ?? "generico",
    variante,
    badgeClasses: meta?.badgeClasses ?? BADGE[variante],
  };
}
