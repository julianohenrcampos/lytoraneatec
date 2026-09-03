/**
 * CT-3F — Contratos da aba Recebimentos (T04–T11).
 * Verificação estática: identidade e autorização permanecem server-side (RPC),
 * a UI apenas separa "A caminho para você" de "Aguardando recebimento".
 */
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const pagina = readFileSync("src/pages/MinhasMobilizacoes.tsx", "utf8");
const hook = readFileSync("src/hooks/central-transporte/useCtOperacao.ts", "utf8");
const service = readFileSync("src/services/ctOperacaoService.ts", "utf8");

describe("CT-3F — Recebimentos", () => {
  it("T02/T13 — listagem continua vindo da RPC autoritativa, sem filtro no cliente", () => {
    expect(service).toContain("fn_ct_recebimentos_pendentes_listar");
    expect(service).toContain("a_caminho");
    expect(pagina).not.toMatch(/recebedorPrevistoNome\s*===/);
  });

  it("T04/T07 — hook expõe as duas listas separadas", () => {
    expect(hook).toContain("aCaminho: query.data?.aCaminho ?? []");
    expect(hook).toContain("ordens: query.data?.ordens ?? []");
  });

  it("T04/T07/T08 — página tem as duas seções com contadores", () => {
    expect(pagina).toContain("ct3f-secao-a-caminho");
    expect(pagina).toContain("ct3f-secao-aguardando");
    expect(pagina).toContain("A caminho para você");
    expect(pagina).toContain("Aguardando recebimento");
  });

  it("T05 — item a caminho é somente leitura (sem ações operacionais)", () => {
    expect(pagina).toContain("somenteLeitura ? (");
    expect(pagina).toContain("<ResumoAcompanhamento ordem={ordem} />");
    expect(pagina).toContain('data-testid={`ct3f-acompanhar-${ordem.id}`}');
    expect(pagina).toMatch(/aCaminho\.map\(\(o\) => \(\s*<OrdemCard key=\{o\.id\} ordem=\{o\} somenteLeitura \/>/);
  });

  it("T08/T09 — recebedor aparece no card e conferência mantém AcoesViagem", () => {
    expect(pagina).toContain("Recebedor:");
    expect(pagina).toContain("<AcoesViagem ordem={ordem} />");
  });

  it("T14 — empty state informa entregas em trânsito", () => {
    expect(pagina).toContain("ct3f-aviso-a-caminho");
    expect(pagina).toContain("entrega está a caminho para você.");
    expect(pagina).toContain("Nenhum recebimento pendente");
  });
});

describe("CT-3F — Recebidos (histórico somente leitura)", () => {
  it("RPC autoritativa devolve a lista de concluídos", () => {
    expect(service).toContain("concluidos: Array.isArray(d.concluidos)");
    expect(hook).toContain("concluidos: query.data?.concluidos ?? []");
  });

  it("seção Recebidos existe e é somente leitura", () => {
    expect(pagina).toContain("ct3f-secao-recebidos");
    expect(pagina).toContain("Recebidos{\" \"}");
    expect(pagina).toMatch(/concluidos\.map\(\(o\) => \(\s*<OrdemCard key=\{o\.id\} ordem=\{o\} somenteLeitura \/>/);
  });

  it("empty state considera as três listas", () => {
    expect(pagina).toContain("recebimentos.concluidos.length === 0 ?");
  });
});
