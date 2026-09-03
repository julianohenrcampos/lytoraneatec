import { describe, it, expect } from "vitest";
import {
  enriquecerDetalhes,
  type RuaAplicacaoRelatorioRow,
} from "@/services/relatorio-aps/relatorioApsRuasService";
import type { DetalheAps } from "@/types/relatorioApsDetalhe";

const rua = (
  o: Partial<RuaAplicacaoRelatorioRow> & { id: string; registroAplicacaoId: string },
): RuaAplicacaoRelatorioRow => ({
  ordemRua: 1,
  chaveNormalizada: "",
  logradouroMapa: "",
  logradouroLocal: "",
  ...o,
});

const det = (o: Partial<DetalheAps> & { id: string; registro_aplicacao_id: string }): DetalheAps => ({
  rua_aplicacao_id: null,
  sequencia_aplicacao: null,
  logradouro_nome: null,
  data_aplicacao: null,
  latitude: null,
  longitude: null,
  fotos_aplicacao: null,
  ...o,
});

describe("enriquecerDetalhes", () => {
  it("preserva logradouro_nome original", () => {
    const detalhes = [det({ id: "d1", registro_aplicacao_id: "r1", rua_aplicacao_id: "rua1", logradouro_nome: "Rua Original" })];
    const ruas = [rua({ id: "rua1", registroAplicacaoId: "r1", logradouroMapa: "Rua Original", logradouroLocal: "Beco Local", chaveNormalizada: "rua original|c|c|s" })];
    const [out] = enriquecerDetalhes(detalhes, ruas);
    expect(out.logradouro_nome).toBe("Rua Original");
    expect(out.logradouroMapa).toBe("Rua Original");
    expect(out.logradouroLocal).toBe("Beco Local");
    expect(out.logradouroExibicao).toBe("Rua Original / Beco Local");
    expect(out.chaveRelatorioRua).toContain("|local:beco local");
  });

  it("fallback para detalhe sem rua_aplicacao_id usa logradouro_nome", () => {
    const detalhes = [det({ id: "d2", registro_aplicacao_id: "r2", logradouro_nome: "Rua Antiga" })];
    const [out] = enriquecerDetalhes(detalhes, []);
    expect(out.ruaAplicacaoId).toBeNull();
    expect(out.logradouroMapa).toBe("Rua Antiga");
    expect(out.logradouroLocal).toBe("");
    expect(out.logradouroExibicao).toBe("Rua Antiga");
    expect(out.chaveRelatorioRua).toBe("rua antiga|local:");
  });

  it("dois detalhes com mesma base mas aliases locais diferentes têm chaves diferentes", () => {
    const detalhes = [
      det({ id: "d1", registro_aplicacao_id: "r1", rua_aplicacao_id: "ra", logradouro_nome: "R" }),
      det({ id: "d2", registro_aplicacao_id: "r1", rua_aplicacao_id: "rb", logradouro_nome: "R" }),
    ];
    const ruas = [
      rua({ id: "ra", registroAplicacaoId: "r1", logradouroMapa: "R", logradouroLocal: "Alias A", chaveNormalizada: "r|b|c|s" }),
      rua({ id: "rb", registroAplicacaoId: "r1", logradouroMapa: "R", logradouroLocal: "Alias B", chaveNormalizada: "r|b|c|s" }),
    ];
    const out = enriquecerDetalhes(detalhes, ruas);
    expect(out[0].chaveRelatorioRua).not.toBe(out[1].chaveRelatorioRua);
  });

  it("bairros diferentes (chave_normalizada diferente) não colidem", () => {
    const detalhes = [
      det({ id: "d1", registro_aplicacao_id: "r1", rua_aplicacao_id: "ra", logradouro_nome: "R" }),
      det({ id: "d2", registro_aplicacao_id: "r1", rua_aplicacao_id: "rb", logradouro_nome: "R" }),
    ];
    const ruas = [
      rua({ id: "ra", registroAplicacaoId: "r1", logradouroMapa: "R", chaveNormalizada: "r|centro|c|s" }),
      rua({ id: "rb", registroAplicacaoId: "r1", logradouroMapa: "R", chaveNormalizada: "r|vila|c|s" }),
    ];
    const out = enriquecerDetalhes(detalhes, ruas);
    expect(out[0].chaveRelatorioRua).not.toBe(out[1].chaveRelatorioRua);
  });

  it("não muta os detalhes de entrada", () => {
    const detalhes = [det({ id: "d1", registro_aplicacao_id: "r1", logradouro_nome: "Rua Y" })];
    const orig = JSON.stringify(detalhes[0]);
    enriquecerDetalhes(detalhes, []);
    expect(JSON.stringify(detalhes[0])).toBe(orig);
  });
});
