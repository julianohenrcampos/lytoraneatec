/**
 * CT-4 — Camada PURA do Movimentação Builder (canvas No-Code multiparadas).
 *
 * Nada aqui toca rede, React ou banco: apenas transformações do rascunho
 * `CtMovDiretaRascunho` já existente. A gravação continua em
 * `fn_ct_mov_direta_salvar_rascunho` e a programação em
 * `fn_ct_mov_direta_programar`, que revalidam tudo server-side.
 *
 * REGRAS ESTRUTURAIS PRESERVADAS
 *  - modalidade, motorista e transportador são GLOBAIS da viagem (colunas
 *    únicas de bd_ct_viagens) — nenhum recurso por parada;
 *  - o mesmo equipamento nunca fica em duas paradas (mesma regra da RPC);
 *  - elegibilidade é do servidor (`elegivel`), nunca recalculada aqui.
 */
import type {
  CtMovDiretaRascunho,
  CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";

/* ------------------------------------------------------------------ */
/* Identificadores de drag-and-drop (dnd-kit)                          */
/* ------------------------------------------------------------------ */

export type MovDragTipo =
  | "MOV_ATIVO"
  | "MOV_MOTORISTA"
  | "MOV_TRANSPORTADOR"
  | "MOV_LOCAL"
  | "MOV_RECEBEDOR";

const DRAG_TIPOS: MovDragTipo[] = [
  "MOV_ATIVO",
  "MOV_MOTORISTA",
  "MOV_TRANSPORTADOR",
  "MOV_LOCAL",
  "MOV_RECEBEDOR",
];

export const movDragId = (tipo: MovDragTipo, id: string): string => `${tipo}:${id}`;

export const parseMovDragId = (
  raw: string | number | null | undefined,
): { tipo: MovDragTipo; id: string } | null => {
  if (typeof raw !== "string") return null;
  const [tipo, ...resto] = raw.split(":");
  if (!DRAG_TIPOS.includes(tipo as MovDragTipo)) return null;
  const id = resto.join(":");
  return id ? { tipo: tipo as MovDragTipo, id } : null;
};

export type MovDropAlvo =
  | { tipo: "MOV_CANVAS" }
  | { tipo: "MOV_PARADA_CARGA"; chaveLocal: string }
  | { tipo: "MOV_PARADA_DESTINO"; chaveLocal: string }
  | { tipo: "MOV_RECEBEDOR_SLOT"; chaveLocal: string }
  | { tipo: "MOV_MOTORISTA_SLOT" }
  | { tipo: "MOV_TRANSPORTADOR_SLOT" }
  | { tipo: "MOV_ORIGEM" }
  | { tipo: "MOV_NOVA_PARADA" };

const DROPS_POR_PARADA = {
  MOV_PARADA_CARGA: "PARADA_CARGA",
  MOV_PARADA_DESTINO: "PARADA_DESTINO",
  MOV_RECEBEDOR_SLOT: "RECEBEDOR_SLOT",
} as const;

export const movDropId = (alvo: MovDropAlvo): string =>
  alvo.tipo in DROPS_POR_PARADA
    ? `MOVDROP:${DROPS_POR_PARADA[alvo.tipo as keyof typeof DROPS_POR_PARADA]}:${
        (alvo as { chaveLocal: string }).chaveLocal
      }`
    : `MOVDROP:${alvo.tipo}`;

export const parseMovDropId = (
  raw: string | number | null | undefined,
): MovDropAlvo | null => {
  if (typeof raw !== "string" || !raw.startsWith("MOVDROP:")) return null;
  const [, tipo, ...resto] = raw.split(":");
  if (tipo === "MOV_CANVAS") return { tipo: "MOV_CANVAS" };
  if (tipo === "MOV_MOTORISTA_SLOT") return { tipo: "MOV_MOTORISTA_SLOT" };
  if (tipo === "MOV_TRANSPORTADOR_SLOT") return { tipo: "MOV_TRANSPORTADOR_SLOT" };
  if (tipo === "MOV_ORIGEM") return { tipo: "MOV_ORIGEM" };
  if (tipo === "MOV_NOVA_PARADA") return { tipo: "MOV_NOVA_PARADA" };
  const chaveLocal = resto.join(":");
  if (!chaveLocal) return null;
  if (tipo === "PARADA_CARGA") return { tipo: "MOV_PARADA_CARGA", chaveLocal };
  if (tipo === "PARADA_DESTINO") return { tipo: "MOV_PARADA_DESTINO", chaveLocal };
  if (tipo === "RECEBEDOR_SLOT") return { tipo: "MOV_RECEBEDOR_SLOT", chaveLocal };
  return null;
};

/** Compatibilidade explícita: pessoa nunca entra na carga e vice-versa. */
export const movDropAceita = (tipo: MovDragTipo, alvo: MovDropAlvo): boolean => {
  switch (tipo) {
    case "MOV_ATIVO":
      return alvo.tipo === "MOV_PARADA_CARGA";
    case "MOV_MOTORISTA":
      return alvo.tipo === "MOV_MOTORISTA_SLOT";
    case "MOV_TRANSPORTADOR":
      return alvo.tipo === "MOV_TRANSPORTADOR_SLOT";
    case "MOV_LOCAL":
      return (
        alvo.tipo === "MOV_ORIGEM" ||
        alvo.tipo === "MOV_PARADA_DESTINO" ||
        alvo.tipo === "MOV_NOVA_PARADA"
      );
    case "MOV_RECEBEDOR":
      return alvo.tipo === "MOV_RECEBEDOR_SLOT";
    default:
      return false;
  }
};

/** Local canônico (bd_centros_custo) usado como recurso arrastável. */
export interface MovLocal {
  id: string;
  rotulo: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
}

/* ------------------------------------------------------------------ */
/* Transformações do rascunho                                          */
/* ------------------------------------------------------------------ */

/**
 * Move (ou insere) um equipamento na parada indicada. Sempre remove das outras
 * paradas antes de inserir — o mesmo ativo nunca fica em duas paradas.
 */
export const moverAtivoParaParada = (
  r: CtMovDiretaRascunho,
  equipamentoId: string,
  chaveLocal: string,
): CtMovDiretaRascunho => {
  if (!r.paradas.some((p) => p.chaveLocal === chaveLocal)) return r;
  const paradas = r.paradas.map((p) => {
    const semAtivo = p.equipamentos.filter((e) => e !== equipamentoId);
    if (p.chaveLocal !== chaveLocal) {
      return semAtivo.length === p.equipamentos.length ? p : { ...p, equipamentos: semAtivo };
    }
    return { ...p, equipamentos: [...semAtivo, equipamentoId] };
  });
  const ativosPlanejados = r.ativosPlanejados.includes(equipamentoId)
    ? r.ativosPlanejados
    : [...r.ativosPlanejados, equipamentoId];
  return { ...r, paradas, ativosPlanejados };
};

/** Retira o ativo da movimentação (de qualquer parada e da lista de participantes). */
export const retirarAtivo = (
  r: CtMovDiretaRascunho,
  equipamentoId: string,
): CtMovDiretaRascunho => ({
  ...r,
  paradas: r.paradas.map((p) =>
    p.equipamentos.includes(equipamentoId)
      ? { ...p, equipamentos: p.equipamentos.filter((e) => e !== equipamentoId) }
      : p,
  ),
  ativosPlanejados: r.ativosPlanejados.filter((e) => e !== equipamentoId),
});

/** Parada em que o ativo está, se houver. */
export const paradaDoAtivo = (
  r: CtMovDiretaRascunho,
  equipamentoId: string,
): { chaveLocal: string; indice: number } | null => {
  const indice = r.paradas.findIndex((p) => p.equipamentos.includes(equipamentoId));
  return indice < 0 ? null : { chaveLocal: r.paradas[indice].chaveLocal, indice };
};

export const definirMotoristaViagem = (
  r: CtMovDiretaRascunho,
  motorista: { id: string; nome: string } | null,
): CtMovDiretaRascunho => ({
  ...r,
  motoristaId: motorista?.id ?? null,
  motoristaNome: motorista?.nome ?? "",
});

export const definirTransportador = (
  r: CtMovDiretaRascunho,
  veiculo: { id: string; placa: string } | null,
): CtMovDiretaRascunho => ({
  ...r,
  veiculoTransportadorId: veiculo?.id ?? null,
  placaTransportador: veiculo?.placa ?? "",
});

/**
 * Origem resolvida pelo LOCAL canônico: endereço e coordenadas vêm do cadastro
 * do centro de custo — nada é digitado/hardcodado aqui. O ponto exato manual
 * (`origemPontoExato`) é preservado; coordenada manual só é sobrescrita quando
 * o cadastro tem coordenada e o usuário ainda não ajustou o ponto.
 */
export const definirOrigemPorLocal = (
  r: CtMovDiretaRascunho,
  local: MovLocal,
): CtMovDiretaRascunho => {
  const semPontoManual = !r.origemPontoExato.trim();
  return {
    ...r,
    origemCentroCustoId: local.id,
    origemEndereco: local.endereco ?? "",
    origemLatitude: semPontoManual ? local.latitude : r.origemLatitude,
    origemLongitude: semPontoManual ? local.longitude : r.origemLongitude,
  };
};

/** Destino da parada resolvido pelo LOCAL canônico (mesma regra da origem). */
export const definirDestinoParada = (
  r: CtMovDiretaRascunho,
  chaveLocal: string,
  local: MovLocal,
): CtMovDiretaRascunho => ({
  ...r,
  paradas: r.paradas.map((p) => {
    if (p.chaveLocal !== chaveLocal) return p;
    const semPontoManual = !p.pontoExato.trim();
    return {
      ...p,
      centroCustoId: local.id,
      endereco: local.endereco ?? "",
      latitude: semPontoManual ? local.latitude : p.latitude,
      longitude: semPontoManual ? local.longitude : p.longitude,
    };
  }),
});

/** Recebedor previsto da parada (funcionário do cadastro, nunca texto livre). */
export const definirRecebedorParada = (
  r: CtMovDiretaRascunho,
  chaveLocal: string,
  recebedor: { id: string; nome: string } | null,
): CtMovDiretaRascunho => ({
  ...r,
  paradas: r.paradas.map((p) =>
    p.chaveLocal === chaveLocal
      ? {
          ...p,
          recebedorPrevistoFuncionarioId: recebedor?.id ?? null,
          recebedorPrevistoNome: recebedor ? "" : p.recebedorPrevistoNome,
        }
      : p,
  ),
});

/** Nova parada já com destino — apenas no rascunho, nada é persistido no drop. */
export const criarParadaComLocal = (
  r: CtMovDiretaRascunho,
  local: MovLocal,
  nova: CtParadaRascunho,
): CtMovDiretaRascunho => {
  const comParada: CtMovDiretaRascunho = { ...r, paradas: [...r.paradas, nova] };
  return definirDestinoParada(comParada, nova.chaveLocal, local);
};

/* ------------------------------------------------------------------ */
/* Vereditos visuais                                                   */
/* ------------------------------------------------------------------ */

export type MovParadaEstado = "INCOMPLETA" | "PRONTA";

export const vereditoParada = (p: CtParadaRascunho): MovParadaEstado =>
  p.centroCustoId && p.equipamentos.length > 0 ? "PRONTA" : "INCOMPLETA";

/**
 * A parada usa data própria? A data da movimentação é `dataPrevistaSaida`; as
 * paradas herdam visualmente e só divergem quando `dataPrevista` é diferente.
 */
export const dataEspecifica = (
  r: CtMovDiretaRascunho,
  p: CtParadaRascunho,
): boolean => !!p.dataPrevista && p.dataPrevista !== r.dataPrevistaSaida;

/** Data exibida no card compacto (herdada quando não há exceção). */
export const dataExibidaParada = (
  r: CtMovDiretaRascunho,
  p: CtParadaRascunho,
): string => p.dataPrevista || r.dataPrevistaSaida || "";

/* ------------------------------------------------------------------ */
/* Pendências visuais do Builder                                       */
/* ------------------------------------------------------------------ */

/**
 * Pendências de APRESENTAÇÃO. Espelham os mesmos invariantes já cobrados por
 * `validarRascunho`/`fn_ct_mov_direta_programar` — nunca substituem a validação
 * server-side, que continua sendo a única autoridade.
 */
export const pendenciasMovimentacao = (r: CtMovDiretaRascunho): string[] => {
  const p: string[] = [];
  if (!r.dataPrevistaSaida) p.push("Data padrão não definida");
  if (!r.modalidade) p.push("Modalidade não definida");
  if (r.modalidade === "TRANSPORTADO" && !r.tipoTransporte)
    p.push("Tipo de transporte não definido");
  if (!r.origemCentroCustoId) p.push("Origem não definida");
  if (!r.motoristaId && !r.motoristaNome.trim()) p.push("Motorista não definido");
  if (r.paradas.length === 0) p.push("Nenhuma parada de entrega");
  r.paradas.forEach((parada, i) => {
    if (!parada.centroCustoId) p.push(`Parada ${i + 1} sem destino`);
    if (parada.equipamentos.length === 0) p.push(`Parada ${i + 1} sem ativos`);
    if (!parada.recebedorPrevistoFuncionarioId && !parada.recebedorPrevistoNome.trim())
      p.push(`Parada ${i + 1} sem recebedor`);
  });
  const comParada = new Set<string>();
  for (const parada of r.paradas) for (const e of parada.equipamentos) comParada.add(e);
  const soltos = r.ativosPlanejados.filter((id) => !comParada.has(id)).length;
  if (soltos > 0) p.push(`${soltos} ativo(s) sem parada`);
  return p;
};
