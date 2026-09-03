/**
 * CT-6 — Contratos do Transport Builder (Etapa 2 — Transporte).
 *
 * Testes de contrato de source + regras puras. Nada aqui aciona rede/RPC.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CT_BUILDER_MAX_CARGA,
  dragId,
  dropAceita,
  dropId,
  estadoMotorista,
  estadoVeiculo,
  jaNoDestino,
  origemDoAgrupamento,
  parseDragId,
  parseDropId,
  patchDataUnica,
  vereditoCard,
} from "@/lib/central-transporte/transportBuilder";
import { criarViagemVazia } from "@/lib/central-transporte/mobilizacaoRascunho";
import {
  ordenarRecebedores,
  prioridadeRecebedor,
  rotuloRecebedor,
} from "@/lib/central-transporte/recebedoresDestino";
import type { CtAtivoMobilizavel } from "@/types/centralTransporteMobilizacao";

const ler = (p: string) => readFileSync(p, "utf8");
const etapa = ler("src/components/central-transporte/solicitacao/EtapaMobilizacao.tsx");
const cardViagem = ler(
  "src/components/central-transporte/solicitacao/builder/ViagemBuilderCard.tsx",
);
const cardAtivo = ler("src/components/central-transporte/solicitacao/builder/AtivoBuilderCard.tsx");
const recursos = ler(
  "src/components/central-transporte/solicitacao/builder/RecursosBuilderPanel.tsx",
);
const editorAvancado = ler("src/components/central-transporte/solicitacao/ViagemCardEditor.tsx");
const hookCadastros = ler("src/hooks/central-transporte/useCtMobilizacaoCadastros.ts");
const hookRecebedores = ler("src/hooks/central-transporte/useCtRecebedoresDestino.ts");

/** Viagem completa: com recebedor e localização de destino resolvidos. */
const completa = (over: Record<string, unknown> = {}) =>
  criarViagemVazia({
    recebedorPrevistoFuncionarioId: "func-recebedor",
    destinoDescargaLatitude: -22.87,
    destinoDescargaLongitude: -43.77,
    ...over,
  });

const ativo = (over: Partial<CtAtivoMobilizavel> = {}): CtAtivoMobilizavel => ({
  atendimentoId: "at-1",
  solicitacaoItemId: "it-1",
  equipamentoId: "eq-1",
  frota: "LYC",
  numeroFrota: "003",
  placa: null,
  statusAtendimento: "RESERVADO",
  periodoInicio: "2026-09-10",
  periodoFim: null,
  centroCustoAtualId: "cc-origem",
  centroCustoAtualNome: "L448",
  movimentacaoId: null,
  movimentacaoStatus: null,
  viagemId: null,
  ...over,
});

describe("CT-6 — layout do Transport Builder", () => {
  it("T01 renderiza três colunas reais no desktop", () => {
    expect(etapa).toContain("ct6-builder-grid");
    expect(etapa).toContain("lg:grid-cols-[190px_minmax(0,1fr)_210px]");
    expect(etapa).toContain("xl:grid-cols-[190px_minmax(0,1fr)_215px]");
    expect(etapa).not.toContain("flex-col lg:grid");
  });

  it("T02 ativos ficam na coluna esquerda, nunca abaixo do canvas", () => {
    expect(etapa).toContain("ct6-coluna-ativos");
    const iAtivos = etapa.indexOf("ct6-coluna-ativos");
    const iCanvas = etapa.indexOf("ct6-coluna-canvas");
    expect(iAtivos).toBeGreaterThan(-1);
    expect(iAtivos).toBeLessThan(iCanvas);
  });

  it("T03/T04 motoristas e transportadores ficam na coluna direita, sticky", () => {
    expect(recursos).toContain("ct6-coluna-recursos");
    expect(recursos).toContain("ct6-motoristas");
    expect(recursos).toContain("ct6-transportadores");
    expect(recursos).toContain("xl:sticky");
    // a coluna direita é renderizada depois do canvas na GRID (nunca empilhada)
    expect(etapa.indexOf("ct6-coluna-canvas")).toBeLessThan(etapa.indexOf("RecursosBuilderPanel\n"));
  });

  it("T05 canvas é a coluna dominante e o card de viagem fica centralizado", () => {
    expect(etapa).toContain("minmax(0,1fr)");
    expect(cardViagem).toContain("max-w-none");
    expect(cardViagem).toContain("mx-auto");
  });

  it("T06/T07 rails possuem scroll interno próprio", () => {
    expect(etapa).toContain("ct6-ativos-scroll");
    expect(etapa).toContain("overflow-y-auto");
    expect(recursos).toContain("max-h-[160px]");
    expect(recursos).toContain("max-h-[120px]");
    expect(recursos).toContain("max-h-[200px]");
  });

  it("workspace tem altura de área de trabalho e dropzone tracejada", () => {
    expect(etapa).toContain("min-h-[560px]");
    expect(etapa).toContain("xl:h-[calc(100vh-300px)]");
    expect(etapa).toContain("border-2 border-dashed");
    expect(etapa).toContain("border-emerald-500");
    expect(etapa).toContain("ct6-dropzone-vazia");
    expect(etapa).toContain("ct6-criar-viagem-manual");
  });

  it("abaixo de 1024px os rails viram Sheets laterais", () => {
    expect(etapa).toContain("ct6-abrir-ativos-mobile");
    expect(etapa).toContain("ct6-abrir-recursos-mobile");
    expect(etapa).toContain("ct6-painel-mobile");
  });
});


describe("CT-6 — drag and drop e fallback", () => {
  it("codifica e decodifica identificadores de arraste", () => {
    expect(parseDragId(dragId("ATIVO", "at-1"))).toEqual({ tipo: "ATIVO", id: "at-1" });
    expect(parseDragId(dragId("MOTORISTA", "f-1"))).toEqual({ tipo: "MOTORISTA", id: "f-1" });
    expect(parseDragId("QUALQUER:1")).toBeNull();
  });

  it("codifica e decodifica alvos de drop", () => {
    expect(parseDropId(dropId({ tipo: "CANVAS" }))).toEqual({ tipo: "CANVAS" });
    expect(parseDropId(dropId({ tipo: "CARGA", chaveLocal: "vg-1" }))).toEqual({
      tipo: "CARGA",
      chaveLocal: "vg-1",
    });
    expect(parseDropId("x")).toBeNull();
  });

  it("T06 ativo solto no canvas cria viagem rodando", () => {
    expect(etapa).toContain("criarViagemRodandoCom");
    expect(etapa).toContain('modalidade: "RODANTE"');
  });

  it("T07 motorista aplicado grava motoristaId", () => {
    expect(etapa).toContain("aplicarMotorista");
    expect(etapa).toContain("motoristaId, motoristaNome: \"\"");
  });

  it("T08 transportador solto no canvas cria viagem embarcada", () => {
    expect(etapa).toContain("criarViagemEmbarcadaCom");
    expect(etapa).toContain('modalidade: "TRANSPORTADO"');
  });

  it("T08/T09/T10 tipos de recurso só entram em alvos compatíveis", () => {
    expect(dropAceita("MOTORISTA", { tipo: "CARGA", chaveLocal: "vg-1" })).toBe(false);
    expect(dropAceita("MOTORISTA", { tipo: "MOTORISTA_SLOT", chaveLocal: "vg-1" })).toBe(true);
    expect(dropAceita("ATIVO", { tipo: "MOTORISTA_SLOT", chaveLocal: "vg-1" })).toBe(false);
    expect(dropAceita("ATIVO", { tipo: "CARGA", chaveLocal: "vg-1" })).toBe(true);
    expect(dropAceita("VEICULO", { tipo: "TRANSPORTADOR_SLOT", chaveLocal: "vg-1" })).toBe(true);
    expect(dropAceita("VEICULO", { tipo: "CARGA", chaveLocal: "vg-1" })).toBe(false);
    expect(dropAceita("MOTORISTA", { tipo: "CANVAS" })).toBe(false);
    expect(etapa).toContain("dropAceita(origem.tipo, alvo)");
    expect(cardViagem).toContain("ct6-transportador-slot-");
    expect(cardViagem).toContain("ct6-motorista-slot-");
  });

  it("T13 viagem rodando não mostra transportador", () => {
    expect(cardViagem).toContain("{transportado && (");
  });

  it("T09/T10 carga tem dropzone própria e limite visual de 3 slots", () => {
    expect(cardViagem).toContain("ct6-carga-");
    expect(CT_BUILDER_MAX_CARGA).toBe(3);
    expect(cardViagem).toContain("CT_BUILDER_MAX_CARGA");
  });

  it("T11 fallback sem drag existe em ativos e recursos", () => {
    expect(cardAtivo).toContain("Adicionar à viagem…");
    expect(recursos).toContain("Usar em nova viagem");
    expect(recursos).toContain("Aplicar à ");
  });
});

describe("CT-6 — data única e destino", () => {
  it("T12 data padrão da etapa existe e pode ser herdada", () => {
    expect(etapa).toContain("ct6-data-padrao");
    expect(etapa).toContain("ct6-aplicar-data");
    expect(etapa).toContain("aplicarDataNasSemData");
  });

  it("T13 nenhuma tela desta etapa pede saída prevista", () => {
    expect(etapa).not.toContain("Saída prevista");
    expect(cardViagem).not.toContain("Saída prevista");
    expect(editorAvancado).not.toContain("Saída prevista");
  });

  it("T13 a data de saída é derivada da data da mobilização", () => {
    expect(patchDataUnica("2026-08-31")).toEqual({
      dataProgramada: "2026-08-31",
      dataPrevistaSaida: "2026-08-31",
    });
  });

  it("T14 destino padrão aparece uma vez no cabeçalho e resumido no card", () => {
    expect(etapa).toContain("ct3e-destino-padrao");
    expect(cardViagem).toContain("ct6-destino-");
  });

  it("T15 rota abre o painel que reutiliza o editor de endereços existente", () => {
    expect(cardViagem).toContain("ct6-ver-rota-");
    expect(etapa).toContain("ct6-sheet-detalhes");
    expect(etapa).toContain("ViagemCardEditor");
    expect(editorAvancado).toContain("ViagemEnderecosEditor");
  });
});

describe("CT-6 — agrupamento e veredito", () => {
  it("T16 vários ativos compartilham transportador, motorista, data, destino e recebedor", () => {
    const v = completa({
      modalidade: "TRANSPORTADO",
      tipoTransporte: "PROPRIO",
      veiculoTransportadorId: "veh-1",
      motoristaId: "mot-1",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-08-31",
      atendimentoIds: ["at-1", "at-2", "at-3"],
    });
    const ativos = [
      ativo(),
      ativo({ atendimentoId: "at-2", equipamentoId: "eq-2" }),
      ativo({ atendimentoId: "at-3", equipamentoId: "eq-3" }),
    ];
    expect(vereditoCard(v, ativos).estado).toBe("PRONTO");
    expect(origemDoAgrupamento(v, ativos).divergente).toBe(false);
  });

  it("T17 origens diferentes não formam agrupamento válido", () => {
    const v = completa({
      modalidade: "TRANSPORTADO",
      tipoTransporte: "PROPRIO",
      veiculoTransportadorId: "veh-1",
      motoristaId: "mot-1",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-08-31",
      atendimentoIds: ["at-1", "at-2"],
    });
    const ativos = [ativo(), ativo({ atendimentoId: "at-2", centroCustoAtualId: "cc-outro" })];
    const veredito = vereditoCard(v, ativos);
    expect(veredito.estado).toBe("CONFLITO");
    expect(veredito.mensagem).toContain("origens diferentes");
    expect(origemDoAgrupamento(v, ativos).quantidade).toBe(2);
  });

  it("T18 ativo já no destino é reconhecido sem exigir viagem", () => {
    expect(jaNoDestino(ativo({ centroCustoAtualId: "cc-destino" }), "cc-destino")).toBe(true);
    expect(jaNoDestino(ativo(), "cc-destino")).toBe(false);
    expect(cardAtivo).toContain("Já no destino");
    expect(cardAtivo).toContain("Atendimento local");
  });

  it("card incompleto sinaliza pendência de motorista", () => {
    const v = completa({
      modalidade: "RODANTE",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-08-31",
      atendimentoIds: ["at-1"],
    });
    const veredito = vereditoCard(v, [ativo()]);
    expect(veredito.estado).toBe("INCOMPLETO");
    expect(veredito.mensagem).toContain("Motorista");
  });

  it("estado dos recursos vem do próprio rascunho (sem motor inventado)", () => {
    const v = criarViagemVazia({ motoristaId: "mot-1", veiculoTransportadorId: "veh-1" });
    expect(estadoMotorista("mot-1", [v])).toBe("EM_USO");
    expect(estadoMotorista("mot-2", [v])).toBe("LIVRE");
    expect(estadoVeiculo("veh-1", [v], [])).toBe("EM_USO");
    const comCarga = criarViagemVazia({ atendimentoIds: ["at-1"] });
    expect(estadoVeiculo("eq-1", [comCarga], [ativo()])).toBe("CONFLITO");
  });
});

describe("CT-6 — backend preservado", () => {
  it("T19/T20 salvar e programar continuam nas RPCs atuais", () => {
    expect(etapa).toContain("mobilizacaoDraft.salvar()");
    expect(etapa).toContain("abrirNovaRevisaoMobilizacao");
    expect(etapa).toContain("ct3d2-ir-revisao");
  });

  it("T21 RBAC e somente leitura seguem governando a etapa", () => {
    expect(etapa).toContain("capabilities.canVisualizar");
    expect(etapa).toContain("capabilities.canEditar");
    expect(etapa).toContain("somenteLeitura");
  });
});


describe("CT-6.1 — motoristas elegíveis", () => {
  it("T19 a lista de motoristas usa a fonte viva canônica do ERP", () => {
    expect(hookCadastros).toContain("fn_motoristas_operacional_lookup");
  });

  it("T20 fallback filtra pela relação função → funcionário, não por texto no cliente", () => {
    expect(hookCadastros).toContain("bd_funcoes!inner(nome_funcao)");
    expect(hookCadastros).toContain('.ilike("bd_funcoes.nome_funcao", "%motorista%")');
    expect(hookCadastros).toContain("STATUS_FUNCIONARIO_ATIVO");
  });

  it("T21 busca de motorista atua sobre a lista elegível (searchText da própria opção)", () => {
    expect(hookCadastros).toContain("searchText");
    expect(recursos).toContain("ct6-motoristas-busca");
  });
});

describe("CT-6.1 — recebedor da viagem", () => {
  it("T22 recebedores vêm dos funcionários ativos do CC destino", () => {
    expect(hookRecebedores).toContain('.in("centro_custo_id", ids)');
    expect(hookRecebedores).toContain('.in("status", STATUS_ATIVO)');
    expect(hookRecebedores).not.toContain("ENGENH");
  });

  it("T23 a mudança de destino troca a lista consultada (chave por CC)", () => {
    expect(hookRecebedores).toContain('queryKey: ["ct6", "recebedores-destino", ids]');
    expect(etapa).toContain("viagens.map((v) => v.destinoCentroCustoId)");
    expect(etapa).toContain("recebedores.porCentroCusto[v.destinoCentroCustoId]");
  });

  it("T24 sugestão prioriza engenheiro, depois apontador, depois demais ativos", () => {
    expect(prioridadeRecebedor("Engenheiro Civil")).toBe(0);
    expect(prioridadeRecebedor("APONTADOR DE OBRA")).toBe(1);
    expect(prioridadeRecebedor("Operador de Máquinas")).toBe(2);
    expect(prioridadeRecebedor(null)).toBe(2);

    const ordenados = ordenarRecebedores([
      { id: "c", nomeCompleto: "Carlos", funcaoNome: "Operador" },
      { id: "b", nomeCompleto: "Bruno", funcaoNome: "Apontador" },
      { id: "a", nomeCompleto: "Ana", funcaoNome: "Engenheira Civil" },
      { id: "d", nomeCompleto: "Bianca", funcaoNome: null },
    ]).map((f) => f.id);
    expect(ordenados).toEqual(["a", "b", "d", "c"]);
    expect(rotuloRecebedor({ id: "a", nomeCompleto: "Ana", funcaoNome: "Engenheira" })).toBe(
      "Ana — Engenheira",
    );
  });

  it("T25 recebedor e local pertencem à viagem — um por card, nunca por ativo", () => {
    expect(cardViagem).toContain("Recebedor");
    expect(cardViagem).toContain("recebedorPrevistoNome");
    expect(cardViagem).toContain("ct6-alterar-entrega-");
    // um único slot de recebedor por card (nunca dentro do loop da carga)
    expect(cardViagem.split("ct6-recebedor-slot-").length - 1).toBe(1);
  });

  it("T26 sem recebedor a viagem não fica pronta", () => {
    const base = {
      modalidade: "RODANTE" as const,
      motoristaId: "mot-1",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-09-01",
      atendimentoIds: ["at-1"],
    };
    const semRecebedor = criarViagemVazia({
      ...base,
      destinoDescargaLatitude: -22.87,
      destinoDescargaLongitude: -43.77,
    });
    const vSem = vereditoCard(semRecebedor, [ativo()]);
    expect(vSem.estado).toBe("INCOMPLETO");
    expect(vSem.pendencias.join(" ")).toContain("Recebedor");

    expect(vereditoCard(completa(base), [ativo()]).estado).toBe("PRONTO");
  });

  it("T27 destino sem coordenada sinaliza localização incompleta", () => {
    const v = criarViagemVazia({
      modalidade: "RODANTE",
      motoristaId: "mot-1",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-09-01",
      atendimentoIds: ["at-1"],
      recebedorPrevistoFuncionarioId: "func-1",
    });
    expect(vereditoCard(v, [ativo()]).pendencias.join(" ")).toContain(
      "Confirme o endereço de entrega",
    );
  });

  it("T28 endereço padrão do destino vem do cadastro do CC (sem mapa permanente)", () => {
    expect(cardViagem).toContain("destinoCc?.endereco");
    expect(cardViagem).not.toContain("<ViagemEnderecosEditor");
    expect(etapa).toContain("patchAutoEnderecoCoordenadas");
  });

  it("T29 alterar frente/local não altera o CC da solicitação", () => {
    expect(cardViagem).not.toContain("destinoCentroCustoId:");
    expect(etapa).toContain("onAlterarEntrega={() => setEntregaChave(v.chaveLocal)}");
  });

  it("T30 não existe segunda data (saída prevista) no card", () => {
    expect(cardViagem).not.toContain("Saída prevista");
    expect(cardViagem.split("type=\"date\"").length - 1).toBe(1);
  });
});


/* ================================================================== *
 * CT-6.2 — recebedor arrastável, entrega em Dialog central e remoção  *
 * ================================================================== */
const dialogEntrega = ler(
  "src/components/central-transporte/solicitacao/builder/EntregaDialog.tsx",
);

describe("CT-6.2 — recursos, entrega e TripCard compacto", () => {
  it("T01 somente motoristas elegíveis alimentam a seção Motoristas", () => {
    expect(hookCadastros).toContain("fn_motoristas_operacional_lookup");
    expect(hookCadastros).toContain('.ilike("bd_funcoes.nome_funcao", "%motorista%")');
    expect(hookCadastros).not.toContain("bd_user_roles");
  });

  it("T02/T03 recebedores só do CC destino — nenhum funcionário de outro CC", () => {
    expect(hookRecebedores).toContain('.in("centro_custo_id", ids)');
    expect(hookRecebedores).toContain('.in("status", STATUS_ATIVO)');
    expect(recursos).toContain("ct6-recebedores");
    expect(etapa).toContain("recebedoresRail");
  });

  it("T04 recebedor é um recurso arrastável próprio (RECEIVER)", () => {
    expect(parseDragId(dragId("RECEBEDOR", "f-9"))).toEqual({ tipo: "RECEBEDOR", id: "f-9" });
    expect(recursos).toContain('tipo="RECEBEDOR"');
  });

  it("T05 existe drop target de recebedor na viagem", () => {
    expect(parseDropId(dropId({ tipo: "RECEBEDOR_SLOT", chaveLocal: "vg-1" }))).toEqual({
      tipo: "RECEBEDOR_SLOT",
      chaveLocal: "vg-1",
    });
    expect(dropAceita("RECEBEDOR", { tipo: "RECEBEDOR_SLOT", chaveLocal: "vg-1" })).toBe(true);
    expect(cardViagem).toContain("RECEBEDOR_SLOT");
  });

  it("T06/T07 motorista e recebedor nunca se misturam", () => {
    expect(dropAceita("MOTORISTA", { tipo: "RECEBEDOR_SLOT", chaveLocal: "vg-1" })).toBe(false);
    expect(dropAceita("RECEBEDOR", { tipo: "MOTORISTA_SLOT", chaveLocal: "vg-1" })).toBe(false);
    expect(dropAceita("RECEBEDOR", { tipo: "CARGA", chaveLocal: "vg-1" })).toBe(false);
    expect(dropAceita("RECEBEDOR", { tipo: "CANVAS" })).toBe(false);
    expect(etapa).toContain("aplicarRecebedor");
    expect(etapa).not.toContain("recebedorPrevistoFuncionarioId: motoristaId");
  });

  it("T08/T09/T10 cada recurso atribuído é removível por [×], sem tocar cadastro", () => {
    expect(cardViagem).toContain("onLimparMotorista");
    expect(cardViagem).toContain("onLimparRecebedor");
    expect(cardViagem).toContain("onLimparVeiculo");
    expect(etapa).toContain("limparMotorista");
    expect(etapa).toContain("limparRecebedor");
    expect(etapa).toContain("limparVeiculo");
    // remoção é patch de rascunho — nenhuma operação terminal de backend
    expect(etapa).not.toContain('operation: "CANCELAR"');
  });

  it("T11 arrastar outro recurso sobre o slot substitui de forma controlada", () => {
    expect(etapa).toContain('toast({ title: "Recebedor alterado." })');
    expect(etapa).toContain("recebedorPrevistoFuncionarioId: funcionarioId");
  });

  it("T12/T13 entrega abre Dialog CENTRAL, nunca Sheet lateral", () => {
    expect(dialogEntrega).toContain("<Dialog");
    expect(dialogEntrega).toContain("max-w-2xl");
    expect(dialogEntrega).toContain("max-h-[85vh]");
    expect(dialogEntrega).not.toContain("SheetContent");
    expect(etapa).toContain("<EntregaDialog");
    expect(etapa).toContain("setEntregaChave");
  });

  it("T14/T15 endereço padrão vem do CC e é ajustável por busca", () => {
    expect(etapa).toContain("patchAutoEnderecoCoordenadas");
    expect(dialogEntrega).toContain("destinoCcEndereco");
    expect(dialogEntrega).toContain("AddressAutocomplete");
    expect(dialogEntrega).toContain("destinoPontoExato: r.endereco_completo");
  });

  it("T16 mapa (Mapbox existente) abre somente sob demanda", () => {
    expect(dialogEntrega).toContain("MapAdjustModal");
    expect(dialogEntrega).toContain("{mapaAberto && (");
    expect(cardViagem).not.toContain("MapAdjustModal");
  });

  it("T17 pessoa externa habilita nome/telefone/observações persistíveis", () => {
    expect(dialogEntrega).toContain("Pessoa externa / terceiro");
    expect(dialogEntrega).toContain("recebedorPrevistoNome");
    expect(dialogEntrega).toContain("recebedorPrevistoTelefone");
    expect(dialogEntrega).toContain("observacoes");
  });

  it("T18 viagem embarcada compartilha um único recebedor", () => {
    const v = completa({
      modalidade: "TRANSPORTADO",
      tipoTransporte: "PROPRIO",
      veiculoTransportadorId: "veh-1",
      motoristaId: "mot-1",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-09-01",
      atendimentoIds: ["at-1", "at-2"],
    });
    expect(vereditoCard(v, [ativo(), ativo({ atendimentoId: "at-2", equipamentoId: "eq-2" })]).estado)
      .toBe("PRONTO");
    expect(cardViagem.split("ct6-recebedor-slot-").length - 1).toBe(1);
  });

  it("T19 TripCard permanece compacto — sem formulários de origem/destino nem mapa", () => {
    expect(cardViagem).not.toContain("Origem — coleta");
    expect(cardViagem).not.toContain("Destino — entrega");
    expect(cardViagem).not.toContain("Confirmar no mapa");
    expect(cardViagem).not.toContain("Combobox");
    expect(cardViagem).not.toContain("Textarea");
    expect(cardViagem.split('type="date"').length - 1).toBe(1);
  });

  it("T20 sem recebedor a viagem não fica pronta", () => {
    const v = criarViagemVazia({
      modalidade: "RODANTE",
      motoristaId: "mot-1",
      destinoCentroCustoId: "cc-destino",
      dataProgramada: "2026-09-01",
      atendimentoIds: ["at-1"],
      destinoDescargaLatitude: -22.87,
      destinoDescargaLongitude: -43.77,
    });
    expect(vereditoCard(v, [ativo()]).pendencias.join(" ")).toContain("Recebedor");
  });
});

describe("CT-6.4 — autoavanço Atender → Transporte por TRANSIÇÃO (T10–T15)", () => {
  const selecao = ler("src/components/central-transporte/solicitacao/EtapaSelecao.tsx");

  it("T10/T11/T12 — autoavanço reage a false→true, nunca ao valor true", () => {
    expect(selecao).toContain("atendimentoAnteriorRef");
    expect(selecao).toContain("anterior === false && todosAtendidos === true");
    // Não existe mais latch "avançou uma vez por visita" que brigava com o stepper
    expect(selecao).not.toContain("avancouRef");
  });

  it("T12 — retorno manual com dados já carregados não re-dispara (anterior null)", () => {
    expect(selecao).toContain("useRef<boolean | null>(null)");
    expect(selecao).toContain("if (itens.length === 0) return;");
  });

  it("T15 — nova conclusão após remoção pode avançar de novo (sem latch permanente)", () => {
    // O ref guarda o VALOR anterior, então true→false→true gera nova transição.
    expect(selecao).toContain("atendimentoAnteriorRef.current = todosAtendidos");
  });
});
