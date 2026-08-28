/**
 * Metadados de apresentação para Chamados Internos.
 * Somente labels/cores/ordem — nenhuma regra de autorização.
 */
import type {
  ChamadoInternoStatus,
  ChamadoInternoSetor,
  ChamadoInternoPrioridade,
  ChamadoInternoEventoTipo,
} from "@/types/chamadosInternos";

interface PresentationMeta {
  label: string;
  descricao?: string;
  ordem: number;
  badgeClasses: string;
}

export const CHAMADO_INTERNO_STATUS_META: Record<ChamadoInternoStatus, PresentationMeta> = {
  aberto:                  { label: "Aberto",                  ordem: 1, badgeClasses: "bg-primary/15 text-primary" },
  em_triagem:              { label: "Em triagem",              ordem: 2, badgeClasses: "bg-muted text-foreground" },
  em_analise:              { label: "Em análise",              ordem: 3, badgeClasses: "bg-secondary/40 text-secondary-foreground" },
  aguardando_solicitante:  { label: "Aguardando solicitante",  ordem: 4, badgeClasses: "bg-accent/40 text-accent-foreground" },
  respondido:              { label: "Respondido",              ordem: 5, badgeClasses: "bg-primary/20 text-primary" },
  resolvido:               { label: "Resolvido",               ordem: 6, badgeClasses: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  encerrado:               { label: "Encerrado",               ordem: 7, badgeClasses: "bg-muted text-muted-foreground" },
  reaberto:                { label: "Reaberto",                ordem: 8, badgeClasses: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  cancelado:               { label: "Cancelado",               ordem: 9, badgeClasses: "bg-destructive/15 text-destructive" },
};

export const CHAMADO_INTERNO_SETOR_META: Record<ChamadoInternoSetor, PresentationMeta> = {
  administracao: { label: "Administração", ordem: 1, badgeClasses: "bg-muted text-foreground" },
  financeiro:    { label: "Financeiro",    ordem: 2, badgeClasses: "bg-primary/10 text-primary" },
  ti:            { label: "TI",            ordem: 3, badgeClasses: "bg-secondary/40 text-secondary-foreground" },
  manutencao:    { label: "Manutenção",    ordem: 4, badgeClasses: "bg-accent/40 text-accent-foreground" },
  eletrica:      { label: "Elétrica",      ordem: 5, badgeClasses: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  sso:           { label: "SSO",           ordem: 6, badgeClasses: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  asfalto:       { label: "Asfalto",       ordem: 7, badgeClasses: "bg-primary/15 text-primary" },
  equipamentos:  { label: "Equipamentos",  ordem: 8, badgeClasses: "bg-secondary/40 text-secondary-foreground" },
};


export const CHAMADO_INTERNO_PRIORIDADE_META: Record<ChamadoInternoPrioridade, PresentationMeta> = {
  baixa:   { label: "Baixa",    ordem: 1, badgeClasses: "bg-muted text-muted-foreground" },
  normal:  { label: "Normal",   ordem: 2, badgeClasses: "bg-primary/10 text-primary" },
  alta:    { label: "Alta",     ordem: 3, badgeClasses: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  critico: { label: "Crítico",  ordem: 4, badgeClasses: "bg-destructive/15 text-destructive" },
};

export const CHAMADO_INTERNO_EVENTO_META: Record<ChamadoInternoEventoTipo, PresentationMeta> = {
  abertura:                 { label: "Abertura",                 ordem: 1,  badgeClasses: "bg-primary/15 text-primary" },
  roteamento:               { label: "Roteamento",               ordem: 2,  badgeClasses: "bg-muted text-foreground" },
  atribuicao:               { label: "Atribuição",               ordem: 3,  badgeClasses: "bg-secondary/40 text-secondary-foreground" },
  resposta_atendente:       { label: "Resposta do atendente",    ordem: 4,  badgeClasses: "bg-primary/10 text-primary" },
  resposta_solicitante:     { label: "Resposta do solicitante",  ordem: 5,  badgeClasses: "bg-accent/40 text-accent-foreground" },
  solicitacao_informacao:   { label: "Solicitação de informação", ordem: 6, badgeClasses: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  nota_interna:             { label: "Nota interna",             ordem: 7,  badgeClasses: "bg-muted text-muted-foreground" },
  mudanca_status:           { label: "Mudança de status",        ordem: 8,  badgeClasses: "bg-secondary/30 text-secondary-foreground" },
  resolucao:                { label: "Resolução",                ordem: 9,  badgeClasses: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  confirmacao_encerramento: { label: "Confirmação de encerramento", ordem: 10, badgeClasses: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  reabertura:               { label: "Reabertura",               ordem: 11, badgeClasses: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  cancelamento:             { label: "Cancelamento",             ordem: 12, badgeClasses: "bg-destructive/15 text-destructive" },
  evento_operacional:       { label: "Processo operacional",     ordem: 13, badgeClasses: "bg-primary/10 text-primary" },
};
