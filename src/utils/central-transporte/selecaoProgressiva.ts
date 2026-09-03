/**
 * CT-3B.2 — Helpers puros do fluxo progressivo da Etapa "Seleção dos ativos".
 *
 * Nenhum contador é calculado aqui: todos os números vêm de
 * fn_ct_atendimento_listar. Estes helpers apenas decidem rótulos e quais
 * blocos da etapa podem ser renderizados.
 */
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtContadores } from "@/types/centralTransporteCT2";
import {
  descricaoItem,
  PROGRESSO_LABELS,
  progressoDoItem,
} from "@/components/central-transporte/solicitacao/itemDisplay";

export const TEXTO_ORIENTACAO_ITEM =
  "Escolha um item da solicitação para visualizar os caminhões e equipamentos compatíveis.";
export const TEXTO_ORIENTACAO_CANDIDATO =
  "Selecione um ativo para visualizar os detalhes e as ações disponíveis.";
export const TEXTO_ACOES_BLOQUEADAS = "Ações bloqueadas até a confirmação do compromisso.";
export const PLACEHOLDER_SELETOR_ITEM = "Selecione um item para atender";

export interface RotuloOpcaoItem {
  descricao: string;
  /** Ex.: "Pendente · 0/1 reservado" */
  situacao: string;
}

/** Rótulo compacto de uma opção do seletor de itens. */
export const rotuloOpcaoItem = (
  item: SolicitacaoItem,
  contadores: CtContadores | null,
): RotuloOpcaoItem => {
  const status = PROGRESSO_LABELS[progressoDoItem(item.quantidade, contadores)];
  const reservado = contadores ? contadores.reservado : null;
  return {
    descricao: descricaoItem(item),
    situacao: `${status} · ${reservado ?? "—"}/${item.quantidade} reservado`,
  };
};

export interface ResumoCompactoItem {
  descricao: string;
  solicitado: number;
  reservado: number | null;
  pendente: number | null;
}

/** Resumo compacto exibido na barra do item selecionado. */
export const resumoCompactoItem = (
  item: SolicitacaoItem | null,
  contadores: CtContadores | null,
): ResumoCompactoItem | null => {
  if (!item) return null;
  return {
    descricao: descricaoItem(item),
    solicitado: item.quantidade,
    reservado: contadores ? contadores.reservado : null,
    pendente: contadores ? contadores.pendentes : null,
  };
};

export interface BlocosVisiveisParams {
  temItemSelecionado: boolean;
  temCandidatoSelecionado: boolean;
  quantidadeVinculados: number;
}

export interface BlocosVisiveis {
  seletorItem: true;
  orientacaoItem: boolean;
  candidatos: boolean;
  painelCandidato: boolean;
  barraAcoes: boolean;
  vinculados: boolean;
}

/**
 * Expansão progressiva: nada além do seletor aparece antes da escolha do item;
 * painel e ações só existem após a escolha do candidato; vinculados apenas
 * quando existe pelo menos um atendimento.
 */
export const blocosVisiveis = ({
  temItemSelecionado,
  temCandidatoSelecionado,
  quantidadeVinculados,
}: BlocosVisiveisParams): BlocosVisiveis => ({
  seletorItem: true,
  orientacaoItem: !temItemSelecionado,
  candidatos: temItemSelecionado,
  painelCandidato: temItemSelecionado && temCandidatoSelecionado,
  barraAcoes: temItemSelecionado && temCandidatoSelecionado,
  vinculados: temItemSelecionado && quantidadeVinculados > 0,
});

/** aria-label do radio de seleção do candidato. */
export const ariaLabelCandidato = (p: {
  frota?: string | null;
  numeroFrota?: string | null;
  placa?: string | null;
  estado?: string | null;
}): string => {
  const identificacao =
    [p.frota, p.numeroFrota].filter(Boolean).join(" ") || p.placa || "Ativo sem identificação";
  const placa = p.placa ? `placa ${p.placa}` : "sem placa";
  const estado = p.estado || "estado não consultado";
  return `Selecionar ${identificacao}, ${placa}, ${estado}`;
};
