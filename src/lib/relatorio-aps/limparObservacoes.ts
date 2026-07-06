/**
 * Extrai apenas as observações reais do apontador a partir do campo
 * `observacoes_gerais` do registro manual, descartando o bloco técnico
 * [CONTEXTO_OPERACIONAL]/[RUAS_APLICACAO] que nunca deve aparecer para o
 * usuário final no Relatório AP's.
 */
import { parseContextoOperacional } from "@/utils/registroAplicacao/parseContextoOperacional";

const TAG_TECNICA_RE = /\[(CONTEXTO_OPERACIONAL|RUAS_APLICACAO|OBSERVACOES_APONTADOR)\]/i;

export function extrairObservacoesLimpas(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  const parsed = parseContextoOperacional(raw);
  if (parsed.observacoesApontador && parsed.observacoesApontador.trim()) {
    return parsed.observacoesApontador.trim();
  }
  if (TAG_TECNICA_RE.test(raw)) return "";
  return raw.trim();
}
