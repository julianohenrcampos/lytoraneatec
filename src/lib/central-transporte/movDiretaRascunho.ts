/**
 * CT-4 — Regras de edição do rascunho da movimentação direta.
 *
 * Puro e testável: monta o payload autoritativo enviado à RPC e valida
 * exatamente os invariantes que o servidor também cobra (fail-closed no
 * cliente apenas para evitar ida e volta — quem decide é o banco).
 */
import type {
  CtMovDiretaRascunho,
  CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";

let contador = 0;
const novaChave = (): string => `parada-${Date.now().toString(36)}-${(contador += 1)}`;

export const paradaVazia = (): CtParadaRascunho => ({
  chaveLocal: novaChave(),
  centroCustoId: null,
  endereco: "",
  pontoExato: "",
  latitude: null,
  longitude: null,
  dataPrevista: "",
  horaPrevista: "",
  observacao: "",
  recebedorPrevistoFuncionarioId: null,
  recebedorPrevistoNome: "",
  equipamentos: [],
});

export const rascunhoVazio = (): CtMovDiretaRascunho => ({
  viagemId: null,
  codigo: null,
  modalidade: null,
  tipoTransporte: null,
  motoristaId: null,
  motoristaNome: "",
  veiculoTransportadorId: null,
  placaTransportador: "",
  empresaTransportadoraId: null,
  dataPrevistaSaida: "",
  origemCentroCustoId: null,
  origemEndereco: "",
  origemPontoExato: "",
  origemLatitude: null,
  origemLongitude: null,
  observacoes: "",
  paradas: [paradaVazia()],
  ativosPlanejados: [],
  rotaPlanejada: null,
});

/** Ativos participantes da movimentação (com ou sem parada de entrega). */
export const ativosDaMovimentacao = (r: CtMovDiretaRascunho): string[] => {
  const ids = new Set<string>(r.ativosPlanejados);
  for (const p of r.paradas) for (const e of p.equipamentos) ids.add(e);
  return Array.from(ids);
};

/** Participantes escolhidos que ainda não foram atribuídos a nenhuma parada. */
export const ativosSemParada = (r: CtMovDiretaRascunho): string[] => {
  const comParada = new Set<string>();
  for (const p of r.paradas) for (const e of p.equipamentos) comParada.add(e);
  return r.ativosPlanejados.filter((id) => !comParada.has(id));
};


/** Equipamentos já alocados em outra parada (bloqueio de duplicidade). */
export const equipamentosJaAlocados = (
  rascunho: CtMovDiretaRascunho,
  exceto?: string,
): Set<string> => {
  const usados = new Set<string>();
  for (const p of rascunho.paradas) {
    if (p.chaveLocal === exceto) continue;
    for (const e of p.equipamentos) usados.add(e);
  }
  return usados;
};

/**
 * Validação mínima para permitir a PROGRAMAÇÃO. O salvamento de rascunho é
 * permissivo (só exige centro de custo em cada parada, igual à RPC).
 */
export const validarRascunho = (
  r: CtMovDiretaRascunho,
  finalidade: "RASCUNHO" | "PROGRAMAR",
): string[] => {
  const erros: string[] = [];
  const paradas = r.paradas;

  if (paradas.length === 0) erros.push("Adicione ao menos uma parada de entrega.");
  paradas.forEach((p, i) => {
    if (!p.centroCustoId) erros.push(`Parada ${i + 1}: informe a obra/centro de custo.`);
  });

  const duplicados = new Set<string>();
  const vistos = new Set<string>();
  for (const p of paradas) {
    for (const e of p.equipamentos) {
      if (vistos.has(e)) duplicados.add(e);
      vistos.add(e);
    }
  }
  if (duplicados.size > 0)
    erros.push("Um mesmo equipamento não pode ser entregue em duas paradas da mesma viagem.");

  if (finalidade === "PROGRAMAR") {
    if (!r.modalidade) erros.push("Selecione a modalidade de deslocamento.");
    if (r.modalidade === "TRANSPORTADO" && !r.tipoTransporte)
      erros.push("Selecione o tipo de transporte (próprio ou terceiro).");
    if (!r.motoristaId && !r.motoristaNome.trim())
      erros.push("Informe o motorista/operador responsável.");
    if (!r.origemCentroCustoId) erros.push("Informe a origem (obra/centro de custo da coleta).");
    if (!r.dataPrevistaSaida) erros.push("Informe a data prevista de saída.");
    if (vistos.size === 0) erros.push("Selecione ao menos um ativo para transportar.");
    if (ativosSemParada(r).length > 0)
      erros.push("Existem ativos da movimentação ainda sem parada de entrega.");
    paradas.forEach((p, i) => {
      if (p.equipamentos.length === 0)
        erros.push(`Parada ${i + 1}: selecione os ativos entregues nesta parada.`);
    });

  }

  return erros;
};

/** Payload autoritativo de fn_ct_mov_direta_salvar_rascunho. */
export const montarPayloadRascunho = (r: CtMovDiretaRascunho): Record<string, unknown> => ({
  modalidade: r.modalidade,
  tipo_transporte: r.modalidade === "TRANSPORTADO" ? r.tipoTransporte : null,
  motorista_id: r.motoristaId,
  motorista_nome: r.motoristaNome.trim() || null,
  veiculo_transportador_id: r.veiculoTransportadorId,
  placa_transportador: r.placaTransportador.trim() || null,
  empresa_transportadora_id: r.empresaTransportadoraId,
  data_prevista_saida: r.dataPrevistaSaida || null,
  origem_centro_custo_id: r.origemCentroCustoId,
  origem_endereco: r.origemEndereco.trim() || null,
  origem_ponto_exato: r.origemPontoExato.trim() || null,
  origem_latitude: r.origemLatitude,
  origem_longitude: r.origemLongitude,
  observacoes: r.observacoes.trim() || null,
  paradas: r.paradas.map((p) => ({
    centro_custo_id: p.centroCustoId,
    endereco: p.endereco.trim() || null,
    ponto_exato: p.pontoExato.trim() || null,
    latitude: p.latitude,
    longitude: p.longitude,
    data_prevista: p.dataPrevista || null,
    hora_prevista: p.horaPrevista || null,
    observacao: p.observacao.trim() || null,
    recebedor_previsto_funcionario_id: p.recebedorPrevistoFuncionarioId,
    recebedor_previsto_nome: p.recebedorPrevistoNome.trim() || null,
    equipamentos: p.equipamentos,
  })),
  /* Participantes da movimentação — o servidor grava os sem parada com parada_id NULL. */
  ativos_planejados: ativosDaMovimentacao(r),
  /* Snapshot da rota planejada; ausente quando o Mapbox não pôde calcular. */
  rota: r.rotaPlanejada
    ? {
        distancia_km: r.rotaPlanejada.distanciaKm,
        duracao_min: r.rotaPlanejada.duracaoMin,
        resumo: r.rotaPlanejada.resumo,
        geometria: r.rotaPlanejada.geometria,
      }
    : null,
});
