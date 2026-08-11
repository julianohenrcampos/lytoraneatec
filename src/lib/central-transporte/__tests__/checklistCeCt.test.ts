import { describe, expect, it } from "vitest";
import {
  divergencias,
  estadoInicial,
  itensDoPersistido,
  montarSnapshot,
  resolveTemplateCarga,
  todosItens,
  validarEstado,
} from "@/lib/central-transporte/checklistCeCt";
import { CHECKLIST_CE_TEMPLATES } from "@/constants/checklistCeTemplates";
import type { CtOrdemCarga } from "@/types/centralTransporteMobilizacao";
import type { CtChecklistPersistido } from "@/types/centralTransporteOperacao";

const template = Object.values(CHECKLIST_CE_TEMPLATES)[0] as never as ReturnType<
  typeof resolveTemplateCarga
>;
const t = template!;

const carga = (subcategoriaId: string | null): CtOrdemCarga => ({
  equipamentoId: "eq-1",
  frota: "FR",
  numeroFrota: "010",
  placa: "ABC1D23",
  movimentacaoId: "mov-1",
  statusMovimentacao: "Ativa",
  subcategoriaId,
  subcategoriaNome: "Escavadeira",
  imagemUrl: null,
  fabricanteNome: "CAT",
  anoFabricacao: 2020,
  tipoAtivo: "Equipamento",
  modelo: "320D",
});

describe("checklistCeCt (CT-3E.3 / CT-3F.1)", () => {
  it("é fail-closed quando a subcategoria não tem checklist oficial", () => {
    expect(resolveTemplateCarga(carga(null))).toBeNull();
    expect(resolveTemplateCarga(carga("00000000-0000-0000-0000-000000000000"))).toBeNull();
  });

  it("no CREATE nasce tudo Conforme (paridade com Apontamento C&E)", () => {
    const state = estadoInicial(t);
    const itens = todosItens(t);
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((i) => state[i.codigo].status === "OK")).toBe(true);
    expect(validarEstado(t, state)).toHaveLength(0);
  });

  it("hidrata o rascunho persistido (snapshot novo e formato legado)", () => {
    const item = todosItens(t)[0];
    const novo = {
      respostas: { itens: { [item.codigo]: { status: "NAO_OK", observacao: "trincado", fotos: ["p1"] } } },
    } as unknown as CtChecklistPersistido;
    const legado = {
      respostas: { [item.codigo]: { status: "NA", observacao: null, fotos: [] } },
    } as unknown as CtChecklistPersistido;

    expect(itensDoPersistido(novo)[item.codigo].status).toBe("NAO_OK");
    expect(estadoInicial(t, novo)[item.codigo].fotosSalvas).toEqual(["p1"]);
    expect(estadoInicial(t, legado)[item.codigo].status).toBe("NA");
  });

  it("exige justificativa e foto em item não conforme", () => {
    const itens = todosItens(t);
    const item = itens.find((i) => i.exigeFotoNaoOk) ?? itens[0];
    const state = estadoInicial(t);
    state[item.codigo] = { status: "NAO_OK", observacao: "", fotosSalvas: [], fotosNovas: [] };
    expect(validarEstado(t, state)).toContain(item.codigo);
    state[item.codigo].observacao = "avaria";
    if (item.exigeFotoNaoOk) {
      expect(validarEstado(t, state)).toContain(item.codigo);
      state[item.codigo].fotosSalvas = ["p1"];
    }
    expect(validarEstado(t, state)).not.toContain(item.codigo);
  });

  it("monta snapshot com resumo e vínculo material", () => {
    const state = estadoInicial(t);
    const snap = montarSnapshot({
      template: t,
      state,
      viagemId: "v-1",
      movimentacaoId: "mov-1",
      carga: carga("sub-1"),
      fase: "SAIDA",
      observacoesGerais: " ok ",
    });
    expect(snap.template_codigo).toBe(t.codigo);
    expect(snap.vinculo).toMatchObject({ viagem_id: "v-1", movimentacao_id: "mov-1", fase: "SAIDA" });
    expect(snap.resumo.total_itens).toBe(todosItens(t).length);
    expect(snap.resumo.aprovado).toBe(true);
    expect(snap.observacoes_gerais).toBe("ok");
  });

  it("detecta divergência entre saída e recebimento", () => {
    const item = todosItens(t)[0];
    const saida = itensDoPersistido({
      respostas: { itens: { [item.codigo]: { status: "OK", observacao: null, fotos: [] } } },
    } as unknown as CtChecklistPersistido);
    const state = estadoInicial(t, null, saida);
    expect(divergencias(t, saida, state)).not.toContain(item.codigo);
    state[item.codigo].status = "NAO_OK";
    expect(divergencias(t, saida, state)).toContain(item.codigo);
  });
});
