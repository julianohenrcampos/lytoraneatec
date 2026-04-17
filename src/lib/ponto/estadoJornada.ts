/**
 * Fonte única de verdade para o estado da jornada de ponto eletrônico.
 * Filtra batidas por data_operacional do servidor e ignora invalidadas.
 */

export type TipoBatida = "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida";

export interface BatidaMin {
  tipo_batida: string;
  data_operacional?: string | null;
  status_validacao?: string | null;
}

export interface EstadoJornada {
  temEntrada: boolean;
  intervaloAberto: boolean;
  temIntervaloFim: boolean;
  temSaida: boolean;
  podeEntrada: boolean;
  podeIntervaloInicio: boolean;
  podeIntervaloFim: boolean;
  podeSaida: boolean;
}

export const ESTADO_VAZIO: EstadoJornada = {
  temEntrada: false,
  intervaloAberto: false,
  temIntervaloFim: false,
  temSaida: false,
  podeEntrada: false,
  podeIntervaloInicio: false,
  podeIntervaloFim: false,
  podeSaida: false,
};

/**
 * Deriva o estado da jornada a partir das batidas e da data operacional do servidor.
 * Se dataOperacional for null/vazio, retorna ESTADO_VAZIO (todos os botões bloqueados).
 */
export function getEstadoJornada(
  batidas: BatidaMin[],
  dataOperacional: string | null,
): EstadoJornada {
  if (!dataOperacional) return ESTADO_VAZIO;

  const hoje = batidas.filter(
    (b) =>
      (!b.data_operacional || b.data_operacional === dataOperacional) &&
      b.status_validacao !== "invalidada",
  );
  const tipos = hoje.map((b) => b.tipo_batida);

  const temEntrada = tipos.includes("entrada");
  const qtdIni = tipos.filter((t) => t === "intervalo_inicio").length;
  const qtdFim = tipos.filter((t) => t === "intervalo_fim").length;
  const intervaloAberto = qtdIni > qtdFim;
  const temIntervaloFim = qtdFim > 0;
  const temSaida = tipos.includes("saida");

  return {
    temEntrada,
    intervaloAberto,
    temIntervaloFim,
    temSaida,
    // Entrada: apenas 1 vez por dia
    podeEntrada: !temEntrada && !temSaida,
    // Início intervalo: após entrada, sem intervalo aberto, sem ciclo já feito
    podeIntervaloInicio: temEntrada && !intervaloAberto && qtdIni === 0 && !temSaida,
    // Fim intervalo: somente se houver intervalo aberto
    podeIntervaloFim: intervaloAberto,
    // Saída: após entrada, sem intervalo aberto, ainda não saiu
    podeSaida: temEntrada && !intervaloAberto && !temSaida,
  };
}
