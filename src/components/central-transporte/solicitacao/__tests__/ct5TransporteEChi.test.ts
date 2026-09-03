/**
 * T16–T23 — Testes de CONTRATO DE SOURCE do fluxo Transporte/Confirmar/CHI.
 *
 * Estes testes leem o código-fonte ativo e verificam invariantes estruturais que
 * não dependem de sessão autenticada nem de RLS (a renderização com dados reais
 * exige preview autenticado e está no roteiro manual):
 *  - campos de transporte renderizados condicionalmente (T16/T17/T18);
 *  - resumo executivo consumindo a fonte material de pendências (T21);
 *  - painel CHI só quando há chamado vinculado (T22);
 *  - timeline do CHI vinda da RPC segura, sem SELECT direto de eventos (T23).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (p: string) => readFileSync(`${process.cwd()}/${p}`, "utf8");

const card = ler("src/components/central-transporte/solicitacao/ViagemCardEditor.tsx");
const revisao = ler("src/components/central-transporte/solicitacao/EtapaRevisao.tsx");
const painel = ler("src/components/central-transporte/solicitacao/ComunicacaoChamadoSheet.tsx");
const header = ler("src/components/central-transporte/solicitacao/SolicitacaoResumoHeader.tsx");
const enderecos = ler("src/components/central-transporte/solicitacao/ViagemEnderecosEditor.tsx");

describe("T16/T17/T18 — campos por modalidade", () => {
  it("T16 — pergunta 'Como o equipamento chegará?' abre a etapa", () => {
    expect(card).toContain("Como o equipamento chegará?");
    expect(card).toContain("ct5-modalidade-");
    expect(card).toContain("MODALIDADES.map");
  });

  it("T16 — veículo transportador e transportadora são condicionais (não RODANTE)", () => {
    expect(card).toMatch(/\{proprio && \(/);
    expect(card).toMatch(/\{terceiro && \(/);
    // tipo de transporte só existe quando TRANSPORTADO
    expect(card).toMatch(/\{transportado && \(/);
  });

  it("T17 — frota própria pede veículo transportador e motorista cadastrado", () => {
    expect(card).toContain("ct5-campo-veiculo-");
    expect(card).toContain("ct5-campo-motorista-");
  });

  it("T18 — terceiro reutiliza campos já previstos no contrato (empresa/placa/motorista)", () => {
    expect(card).toContain("ct5-campo-empresa-");
    expect(card).toContain("ct5-campo-placa-");
    expect(card).toContain("empresaTransportadoraId");
    expect(card).toContain("placaTransportador");
    // nenhum campo novo de banco foi inventado
    expect(card).not.toMatch(/campo_novo|transportadora_nova/);
  });
});

describe("T19/T20 — rota automática e ausência de geolocalização", () => {
  it("T19 — reutiliza a única camada Mapbox existente", () => {
    expect(enderecos).toContain("calcularAlternativasRota");
    expect(enderecos).not.toMatch(/api\.mapbox\.com/);
  });

  it("T19 — anti-loop por assinatura em ref, uma chamada por combinação", () => {
    expect(enderecos).toContain("assinaturaCalculadaRef");
    expect(enderecos).toContain("assinaturaRota(viagem)");
  });

  it("T20 — aviso funcional e ajuste manual pelo mapa existente", () => {
    expect(enderecos).toContain("ct5-aviso-cc-sem-geo-");
    expect(enderecos).toContain("Localização do Centro de Custo incompleta");
    expect(enderecos).toContain("ct5-definir-ponto-mapa-");
  });
});

describe("T21 — resumo executivo do Confirmar", () => {
  it("renderiza o resumo executivo e o botão Programar atendimento", () => {
    expect(revisao).toContain("ct5-resumo-executivo");
    expect(revisao).toContain("Programar atendimento");
    expect(revisao).toContain("ativos definidos");
  });

  it("pendências vêm de validarProgramacao — nunca por inferência visual", () => {
    expect(revisao).toContain("validarProgramacao");
    expect(revisao).toMatch(/problemas\.length === 0/);
    expect(revisao).toContain("ct5-com-pendencias");
  });
});

describe("T22/T23 — painel de Comunicação do chamado", () => {
  it("T22 — botão existe apenas quando há chamado vinculado", () => {
    expect(header).toContain("ct5-btn-comunicacao-chamado");
    expect(header).toMatch(/chamadoId && \(/);
    expect(header).toContain("solicitacao.chamado_id");
  });

  it("T23 — timeline vem da RPC segura via service, sem SELECT direto de eventos", () => {
    expect(painel).toContain("listarEventos");
    expect(painel).toContain("chamadosInternosService");
    expect(painel).not.toContain("bd_chamado_interno_eventos");
    expect(painel).not.toMatch(/from\("bd_chamado/);
    // nenhuma regra de visibilidade reimplementada no cliente
    expect(painel).not.toMatch(/role === /);
    expect(painel).not.toMatch(/nota_interna\s*(&&|\?)/);
  });

  it("painel é somente leitura e faz deep link para o chamado completo", () => {
    expect(painel).toContain("Abrir chamado completo");
    expect(painel).not.toMatch(/registrarEvento|responder|enviarMensagem/);
  });
});
