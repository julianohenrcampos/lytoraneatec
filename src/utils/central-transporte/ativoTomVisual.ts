/**
 * CT-3E — Mapper VISUAL único do tom de disponibilidade de um ativo candidato.
 *
 * IMPORTANTE: é apresentação. Nenhuma regra operacional nova é criada aqui.
 * O tom deriva EXCLUSIVAMENTE dos campos já produzidos pela superfície canônica
 * (`toCandidateSelection`, que por sua vez lê a análise CT-1 e o estado efetivo
 * CT-2.2). Quem autoriza a operação continua sendo o servidor.
 *
 *  VERDE    → alocação imediata possível (permiteInterno)
 *  LARANJA  → planejável / liberação futura / compatibilidade parcial
 *  VERMELHO → bloqueado (sem registro, comprometido, conflito, estado não consultado)
 */
import type { CtCandidateSelection } from "@/types/centralTransporteCT2";

export type CtTomAtivo = "VERDE" | "LARANJA" | "VERMELHO";

export interface CtTomVisual {
  tom: CtTomAtivo;
  /** Rótulo curto de status resumido para o mini-card. */
  label: string;
  /** Classes semânticas (tokens do design system) da borda/fundo do card. */
  classes: string;
  /** Classes do ponto/indicador. */
  pontoClasses: string;
}

export const CT_TOM_CLASSES: Record<CtTomAtivo, string> = {
  VERDE: "border-emerald-600/50 bg-emerald-600/5 hover:bg-emerald-600/10",
  LARANJA: "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10",
  VERMELHO: "border-destructive/50 bg-destructive/5 hover:bg-destructive/10",
};

export const CT_TOM_PONTO: Record<CtTomAtivo, string> = {
  VERDE: "bg-emerald-600",
  LARANJA: "bg-amber-500",
  VERMELHO: "bg-destructive",
};

/** Tom visual do candidato — puro, testável, sem acesso a rede. */
export const tomDoCandidato = (c: CtCandidateSelection | null): CtTomVisual => {
  const monta = (tom: CtTomAtivo, label: string): CtTomVisual => ({
    tom,
    label,
    classes: CT_TOM_CLASSES[tom],
    pontoClasses: CT_TOM_PONTO[tom],
  });

  if (!c) return monta("VERMELHO", "Indisponível");

  if (!c.estadoConsultado) return monta("VERMELHO", "Estado não consultado");
  if (c.precisaRegularizarDisponibilidade) return monta("VERMELHO", "Sem registro operacional");
  if (c.conflitoCadastral) return monta("VERMELHO", "Conflito cadastral");
  if (c.compromissoBloqueia) return monta("VERMELHO", c.compromissoLabel || "Comprometido");

  const statusBloqueado =
    c.disponibilidadeStatus === "MANUTENCAO" || c.disponibilidadeStatus === "INDISPONIVEL";
  if (statusBloqueado) {
    return monta("VERMELHO", c.disponibilidadeStatus === "MANUTENCAO" ? "Manutenção" : "Indisponível");
  }

  if (c.permiteInterno) {
    return c.matchTipo === "PARCIAL"
      ? monta("LARANJA", "Disponível — compatibilidade parcial")
      : monta("VERDE", "Disponível");
  }

  if (c.permiteReservaFutura) {
    return monta("LARANJA", c.previsaoLiberacao ? "Liberação próxima" : "Planejável");
  }

  return monta("VERMELHO", "Indisponível");
};

export default tomDoCandidato;
