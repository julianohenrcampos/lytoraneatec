/**
 * Helpers puros para ações na tabela de Solicitações de Equipamento.
 * Sem I/O. Sem consulta a banco. Sem side effects.
 */
import { formatDateBR } from "@/utils/formatDateBR";
import type { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";

export const STATUS_CANCELADO = "CANCELADO";

const EDITAVEIS = new Set(["RASCUNHO", "PENDENTE_APROVACAO"]);
const BLOQUEIA_CANCELAR = new Set([
  "EM_TRANSPORTE",
  "EM_EXECUCAO",
  "CONCLUIDO",
  "NEGADO",
  STATUS_CANCELADO,
]);

export function isCancelada(
  s: Pick<SolicitacaoEquipamento, "status_fluxo"> | null | undefined,
): boolean {
  return !!s && String(s.status_fluxo) === STATUS_CANCELADO;
}

function hasWildcard(permissions?: string[] | null): boolean {
  return Array.isArray(permissions) && permissions.includes("*");
}

function isSolicitante(
  s: Pick<SolicitacaoEquipamento, "solicitante_id"> | null | undefined,
  userId?: string | null,
): boolean {
  return !!s && !!userId && s.solicitante_id === userId;
}

export function podeEditarSolicitacao(
  s: SolicitacaoEquipamento | null | undefined,
  userId?: string | null,
  isSuperAdmin?: boolean,
  permissions?: string[] | null,
): boolean {
  if (!s) return false;
  if (!EDITAVEIS.has(String(s.status_fluxo))) return false;
  return isSolicitante(s, userId) || !!isSuperAdmin || hasWildcard(permissions);
}

export function podeCancelarSolicitacao(
  s: SolicitacaoEquipamento | null | undefined,
  userId?: string | null,
  isSuperAdmin?: boolean,
  permissions?: string[] | null,
): boolean {
  if (!s) return false;
  const status = String(s.status_fluxo);
  if (BLOQUEIA_CANCELAR.has(status)) return false;
  if (EDITAVEIS.has(status) && isSolicitante(s, userId)) return true;
  if ((isSuperAdmin || hasWildcard(permissions)) && (EDITAVEIS.has(status) || status === "APROVADO")) {
    return true;
  }
  return false;
}

export function podeExcluirSolicitacao(
  s: SolicitacaoEquipamento | null | undefined,
  userId?: string | null,
  isSuperAdmin?: boolean,
  permissions?: string[] | null,
  opts?: { temHistoricoCritico?: boolean },
): boolean {
  if (!s) return false;
  if (opts?.temHistoricoCritico) return false;
  if (isSuperAdmin || hasWildcard(permissions)) return true;
  const status = String(s.status_fluxo);
  if (EDITAVEIS.has(status) && isSolicitante(s, userId)) return true;
  return false;
}

export interface StatusBadgeConfig {
  label: string;
  className: string;
}

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_APROVACAO: "Pendente Aprovação",
  APROVADO: "Aprovado",
  EM_TRANSPORTE: "Em Transporte",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDO: "Concluído",
  NEGADO: "Negado",
  CANCELADO: "Cancelado",
};

const STATUS_CLASSES: Record<string, string> = {
  RASCUNHO: "bg-muted text-muted-foreground",
  PENDENTE_APROVACAO: "bg-yellow-100 text-yellow-800",
  APROVADO: "bg-green-100 text-green-800",
  EM_TRANSPORTE: "bg-blue-100 text-blue-800",
  EM_EXECUCAO: "bg-purple-100 text-purple-800",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
  NEGADO: "bg-red-100 text-red-800",
  CANCELADO: "bg-gray-200 text-gray-700",
};

export function getStatusBadgeConfig(status_fluxo?: string | null): StatusBadgeConfig {
  const key = String(status_fluxo || "");
  return {
    label: STATUS_LABELS[key] || key || "-",
    className: STATUS_CLASSES[key] || "",
  };
}

/**
 * Anexa ao final de `previous` uma linha registrando o cancelamento.
 * Preserva conteúdo anterior. Data em dd/mm/aaaa.
 */
export function appendCancelamentoJustificativa(
  previous: string | null | undefined,
  motivo: string,
  userLabel?: string | null,
  when: Date = new Date(),
): string {
  const base = (previous ?? "").trimEnd();
  const autor = (userLabel && userLabel.trim()) || "usuário";
  const data = formatDateBR(when);
  const linha = `[CANCELADO em ${data} por ${autor}]: ${motivo.trim()}`;
  return base ? `${base}\n${linha}` : linha;
}
