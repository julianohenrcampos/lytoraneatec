/**
 * CT-9 — Contratos de SOURCE do Atendimento Builder (Solicitação da CT).
 *
 * Só apresentação/composição: nenhuma RPC, tabela ou regra de matching é
 * testada aqui — apenas que a montagem passou a ser UMA tela e que as
 * operações autoritativas continuam sendo as mesmas.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = "src/components/central-transporte/solicitacao";
const ler = (f: string) => readFileSync(join(process.cwd(), raiz, f), "utf8");

const pagina = ler("CentralTransporteSolicitacaoPage.tsx");
const montar = ler("EtapaMontarAtendimento.tsx");
const builder = ler("EtapaMobilizacao.tsx");
const atender = ler("builder/useAtenderVinculo.tsx");
const itemAlvo = ler("builder/ItemAtendimentoAlvoCard.tsx");
const candidatos = ler("AtivosCandidatosCards.tsx");

describe("CT-9 — Solicitação como Builder No-Code em 2 etapas", () => {
  it("S01/S02 a página usa um único workspace para as três etapas técnicas", () => {
    expect(pagina).toContain("EtapaMontarAtendimento");
    expect(pagina).toContain('etapa === "ITENS" || etapa === "SELECAO" || etapa === "MOBILIZACAO"');
    expect(pagina).toContain('etapa === "REVISAO" && <EtapaRevisao />');
    // nenhuma tela separada de seleção continua roteada
    expect(pagina).not.toContain("<EtapaSelecao />");
  });

  it("S03/S06 candidatos vivem no rail esquerdo, com a MESMA fonte de análise", () => {
    expect(montar).toContain("railCandidatos={atender.railCandidatos}");
    expect(builder).toContain('data-testid="ct9-coluna-candidatos"');
    expect(atender).toContain("AtivosCandidatosCards");
    expect(atender).toContain("toCandidateSelection");
    expect(atender).toContain("AtribuirAtendimentoModal");
    expect(atender).toContain("SubstituirAtendimentoModal");
  });

  it("S04/S05 drop de candidato no item e fallback por clique", () => {
    expect(itemAlvo).toContain("CT_DND_MIME_ATIVO");
    expect(itemAlvo).toContain("onDrop");
    expect(atender).toContain("soltarNoItem(item.id, equipamentoId)");
    expect(atender).toContain("onVincular={vincularAtivo}");
    expect(itemAlvo).toContain("Escolher ativo");
  });

  it("S07/S08/S09 modalidades e viagens seguem no mesmo canvas", () => {
    expect(montar).toContain("canvasTopo={atender.itensStrip}");
    expect(builder).toContain('data-testid="ct9-canvas-topo"');
    expect(builder).toContain("criarViagemRodandoCom");
    expect(builder).toContain("criarViagemEmbarcadaCom");
    expect(builder).toContain("atribuirAtivoAViagem");
  });

  it("S10/S11/S12/S13 recursos arrastáveis e limpezas preservados", () => {
    expect(builder).toContain("RecursosBuilderPanel");
    expect(builder).toContain("aplicarMotorista");
    expect(builder).toContain("aplicarRecebedor");
    expect(builder).toContain("aplicarVeiculo");
    expect(builder).toContain("limparMotorista");
    expect(builder).toContain("limparRecebedor");
    expect(builder).toContain("limparVeiculo");
  });

  it("S14/S15/S16 destino padrão, data padrão e já no destino preservados", () => {
    expect(builder).toContain("ct3e-destino-padrao");
    expect(builder).toContain("ct6-data-padrao");
    expect(builder).toContain("aplicarDataNasSemData");
    expect(builder).toContain("jaNoDestino");
  });

  it("S17 troca de ativo usa o fluxo autoritativo de substituição", () => {
    expect(itemAlvo).toContain("Alterar ativo");
    expect(atender).toContain("setSubstituirAlvo(a)");
  });

  it("S20 programação/rascunho continuam nas RPCs atuais", () => {
    expect(builder).toContain("mobilizacaoDraft.salvar()");
    expect(builder).toContain('data-testid="ct3d2-ir-revisao"');
  });

  it("S23 rails com scroll interno, sem consulta por card", () => {
    expect(candidatos).toContain("compacto");
    expect(candidatos).toContain("overflow-y-auto");
    expect(builder).toContain("ct6-ativos-scroll");
    expect(atender).not.toContain("supabase");
  });

  it("S26 nenhum autoavanço de etapa dentro do Builder", () => {
    expect(montar).not.toContain("irParaEtapa");
    expect(atender).not.toContain("irParaEtapa");
  });

  it("grade de 3 colunas do Builder com canvas dominante", () => {
    expect(builder).toContain("lg:grid-cols-[250px_minmax(0,1fr)_220px]");
    expect(builder).toContain("minmax(0,1fr)");
  });
});
