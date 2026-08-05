/**
 * CT-3C R2 — Regras puras do rascunho de mobilização (isoladas da UI).
 *
 * Espelham `fn_ct_mobilizacao_salvar_rascunho` e `fn_ct_mob_validar_viagem`:
 * o servidor é a autoridade, a UI apenas antecipa o mesmo veredito.
 *
 * Invariantes:
 *  - cada ativo pertence a NO MÁXIMO uma viagem;
 *  - modalidade é explícita: RODANTE (1 ativo, com motorista) ou TRANSPORTADO;
 *  - TRANSPORTADO exige tipo: PROPRIO (veículo + motorista) ou TERCEIRO
 *    (transportadora + placa + nome do motorista);
 *  - origem e destino são centros de custo relacionais;
 *  - a data da mobilização não pode ser posterior ao início do período reservado;
 *  - mobilização parcial é permitida (ativos fora de viagem seguem aguardando).
 */
import type {
  CtAtivoMobilizavel,
  CtMobilizacaoEstado,
  CtModalidade,
  CtViagem,
  CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";

let contadorLocal = 0;

export const novaChaveLocal = (): string => `vg-local-${++contadorLocal}`;

const novoUuid = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const criarViagemVazia = (
  over: Partial<CtViagemRascunho> = {},
): CtViagemRascunho => ({
  chaveLocal: novaChaveLocal(),
  clientRef: novoUuid(),
  id: null,
  codigo: null,
  modalidade: null,
  tipoTransporte: null,
  motoristaId: null,
  motoristaNome: "",
  motoristaCpf: "",
  veiculoTransportadorId: null,
  placaTransportador: "",
  empresaTransportadoraId: null,
  origemCentroCustoId: null,
  destinoCentroCustoId: null,
  dataPrevistaSaida: "",
  dataProgramada: "",
  distanciaKm: "",
  observacoes: "",
  atendimentoIds: [],
  ...over,
});

const daViagem = (v: CtViagem): CtViagemRascunho => ({
  chaveLocal: `vg-${v.id}`,
  clientRef: v.id,
  id: v.id,
  codigo: v.codigo,
  modalidade: v.modalidade,
  tipoTransporte: v.tipoTransporte,
  motoristaId: v.motoristaId,
  motoristaNome: v.motoristaId ? "" : (v.motoristaNomeSnapshot ?? ""),
  motoristaCpf: v.motoristaId ? "" : (v.motoristaCpfSnapshot ?? ""),
  veiculoTransportadorId: v.veiculoTransportadorId,
  placaTransportador: v.veiculoTransportadorId
    ? ""
    : (v.placaTransportadorSnapshot ?? ""),
  empresaTransportadoraId: v.empresaTransportadoraId,
  origemCentroCustoId: v.origemCentroCustoId,
  destinoCentroCustoId: v.destinoCentroCustoId,
  dataPrevistaSaida: v.dataPrevistaSaida ?? "",
  dataProgramada: v.dataPrevistaEntrega ?? "",
  distanciaKm: v.distanciaKm === null ? "" : String(v.distanciaKm),
  observacoes: v.observacoes ?? "",
  atendimentoIds: [...v.atendimentoIds],
});

/** Converte o estado do servidor em rascunho editável (sem inventar viagens). */
export const hidratarRascunho = (estado: CtMobilizacaoEstado | null): CtViagemRascunho[] => {
  if (!estado) return [];
  const base = estado.rascunhoEmEdicao?.viagens ?? estado.viagens;
  return base.map(daViagem);
};

/** Sugestão de modalidade: ativo com placa normalmente é rodante. */
export const sugerirModalidade = (a: CtAtivoMobilizavel): CtModalidade =>
  a.placa && a.placa.trim() !== "" ? "RODANTE" : "TRANSPORTADO";

/** Mapa atendimentoId → chaveLocal da viagem em que ele está. */
export const indiceAtendimentos = (viagens: CtViagemRascunho[]): Map<string, string> => {
  const m = new Map<string, string>();
  for (const v of viagens) {
    for (const at of v.atendimentoIds) if (!m.has(at)) m.set(at, v.chaveLocal);
  }
  return m;
};

/** Move o ativo para a viagem informada, retirando-o de qualquer outra. */
export const atribuirAtivoAViagem = (
  viagens: CtViagemRascunho[],
  atendimentoId: string,
  chaveLocalDestino: string | null,
): CtViagemRascunho[] =>
  viagens.map((v) => {
    const semAtivo = v.atendimentoIds.filter((id) => id !== atendimentoId);
    if (chaveLocalDestino && v.chaveLocal === chaveLocalDestino) {
      return { ...v, atendimentoIds: [...semAtivo, atendimentoId] };
    }
    return semAtivo.length === v.atendimentoIds.length ? v : { ...v, atendimentoIds: semAtivo };
  });

export interface ProblemaRascunho {
  chaveLocal: string | null;
  mensagem: string;
}

/** Problemas que impedem SALVAR o rascunho (estruturais, espelham a RPC). */
export const validarRascunho = (viagens: CtViagemRascunho[]): ProblemaRascunho[] => {
  const problemas: ProblemaRascunho[] = [];
  const vistos = new Set<string>();

  for (const v of viagens) {
    for (const at of v.atendimentoIds) {
      if (vistos.has(at)) {
        problemas.push({
          chaveLocal: v.chaveLocal,
          mensagem: "Um ativo está agrupado em mais de uma viagem.",
        });
      }
      vistos.add(at);
    }

    if (!v.modalidade) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "Escolha a modalidade da viagem: rodante ou transportado.",
      });
    }
    if (v.modalidade === "TRANSPORTADO" && !v.tipoTransporte) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "Informe se o transporte é próprio ou de terceiro.",
      });
    }
    if (v.modalidade === "RODANTE" && v.atendimentoIds.length > 1) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "Uma viagem rodante transporta exatamente um ativo.",
      });
    }
    if (v.dataPrevistaSaida && v.dataProgramada && v.dataPrevistaSaida > v.dataProgramada) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "A data de saída não pode ser posterior à data da mobilização.",
      });
    }
    if (v.distanciaKm.trim() !== "" && !Number.isFinite(Number(v.distanciaKm))) {
      problemas.push({ chaveLocal: v.chaveLocal, mensagem: "Distância inválida." });
    }
  }

  return problemas;
};

/** Problemas que impedem PROGRAMAR (completude operacional). */
export const validarProgramacao = (
  viagens: CtViagemRascunho[],
  ativos: CtAtivoMobilizavel[],
): ProblemaRascunho[] => {
  const problemas = validarRascunho(viagens);
  const porAtendimento = new Map(ativos.map((a) => [a.atendimentoId, a]));

  const viagensAtivas = viagens.filter((v) => v.atendimentoIds.length > 0);
  if (viagensAtivas.length === 0) {
    problemas.push({
      chaveLocal: null,
      mensagem: "Crie ao menos uma viagem com ativos antes de programar.",
    });
  }

  for (const v of viagensAtivas) {
    if (!v.dataProgramada) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "Informe a data programada da mobilização.",
      });
    }
    if (!v.origemCentroCustoId || !v.destinoCentroCustoId) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "Informe o centro de custo de origem e de destino.",
      });
    }

    if (v.modalidade === "RODANTE" && !v.motoristaId) {
      problemas.push({
        chaveLocal: v.chaveLocal,
        mensagem: "Informe o motorista ou operador da viagem rodante.",
      });
    }
    if (v.modalidade === "TRANSPORTADO" && v.tipoTransporte === "PROPRIO") {
      if (!v.veiculoTransportadorId || !v.motoristaId) {
        problemas.push({
          chaveLocal: v.chaveLocal,
          mensagem: "Transporte próprio exige veículo transportador e motorista.",
        });
      }
    }
    if (v.modalidade === "TRANSPORTADO" && v.tipoTransporte === "TERCEIRO") {
      if (
        !v.empresaTransportadoraId ||
        !v.placaTransportador.trim() ||
        !(v.motoristaId || v.motoristaNome.trim())
      ) {
        problemas.push({
          chaveLocal: v.chaveLocal,
          mensagem: "Transporte de terceiro exige transportadora, placa e nome do motorista.",
        });
      }
    }

    if (v.veiculoTransportadorId) {
      const carga = v.atendimentoIds
        .map((at) => porAtendimento.get(at)?.equipamentoId)
        .filter(Boolean);
      if (carga.includes(v.veiculoTransportadorId)) {
        problemas.push({
          chaveLocal: v.chaveLocal,
          mensagem: "O veículo transportador não pode ser carga da própria viagem.",
        });
      }
    }

    if (v.dataProgramada) {
      const inicios = v.atendimentoIds
        .map((at) => porAtendimento.get(at)?.periodoInicio)
        .filter((d): d is string => !!d);
      const minimo = inicios.sort()[0];
      if (minimo && v.dataProgramada > minimo) {
        problemas.push({
          chaveLocal: v.chaveLocal,
          mensagem:
            "A data da mobilização deve ser anterior ou igual ao início do período reservado.",
        });
      }
    }
  }

  return problemas;
};

/**
 * Assinatura material do rascunho — mesma chave ⇒ mesmo request_id (CT-2/M4).
 * Espelha os campos de `fn_ct_mob_content_hash` (ordem irrelevante).
 */
export const chaveMaterialRascunho = (
  solicitacaoId: string,
  viagens: CtViagemRascunho[],
): string =>
  [
    "MOB_RASCUNHO",
    solicitacaoId,
    ...viagens
      .map((v) =>
        [
          v.modalidade ?? "",
          v.tipoTransporte ?? "",
          v.motoristaId ?? "",
          v.motoristaNome.trim(),
          v.motoristaCpf.replace(/\D/g, ""),
          v.veiculoTransportadorId ?? "",
          v.placaTransportador.trim().toUpperCase(),
          v.empresaTransportadoraId ?? "",
          v.origemCentroCustoId ?? "",
          v.destinoCentroCustoId ?? "",
          v.dataPrevistaSaida,
          v.dataProgramada,
          v.distanciaKm.trim(),
          v.observacoes.trim(),
          [...v.atendimentoIds].sort().join("+"),
        ].join("|"),
      )
      .sort(),
  ].join("::");

export const rotuloAtivo = (a: CtAtivoMobilizavel): string =>
  [a.frota, a.numeroFrota].filter(Boolean).join("-") || a.placa || "Ativo sem identificação";
