/**
 * CT-2 / G0+G1+G2 — Fail-closed, regularização assistida e invalidação.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import { normalizeCt2Error } from "@/utils/ct2ErrorMapper";
import {
  chaveEhAtivoOperacional,
  invalidarCachesAtivosOperacionais,
} from "@/lib/queryInvalidation/ativosOperacionais";

const baseAtivo = {
  equipamento_id: "eq-1",
  frota: "LYC",
  numero_frota: "001",
  placa: "KMT6874",
  compatibilidade: "EXATA" as const,
  motivo_compatibilidade: null,
  status_operacional: "DISPONIVEL",
  previsao_liberacao: null as string | null,
  possui_registro_disponibilidade: true,
  possui_centro_custo_atual: true,
  ja_no_centro_custo_destino: false,
  situacao_cadastral: "Disponível",
  conflito_cadastral: false,
  conflito_cadastral_motivo: null,
  bloqueio_motivo: null,
  centro_custo_atual_codigo: "L503",
  centro_custo_atual_nome: "OBRA TESTE",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const cand = (over: Record<string, unknown>) =>
  toCandidateSelection({ ...baseAtivo, ...over } as any, "PROPRIA");
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("G0 — fail-closed no adapter de candidatos", () => {
  it("ativo COM registro e DISPONIVEL permite atendimento interno", () => {
    const c = cand({});
    expect(c?.permiteInterno).toBe(true);
    expect(c?.precisaRegularizarDisponibilidade).toBe(false);
  });

  it("ativo SEM registro NÃO permite interno mesmo com status DISPONIVEL herdado", () => {
    const c = cand({ possui_registro_disponibilidade: false, status_operacional: "DISPONIVEL" });
    expect(c?.permiteInterno).toBe(false);
    expect(c?.precisaRegularizarDisponibilidade).toBe(true);
  });

  it("ativo SEM registro NÃO permite reserva futura nem com previsão de liberação", () => {
    const c = cand({ possui_registro_disponibilidade: false, previsao_liberacao: "2026-08-01" });
    expect(c?.permiteReservaFutura).toBe(false);
  });

  it("ativo SEM_STATUS canônico permanece bloqueado", () => {
    const c = cand({ possui_registro_disponibilidade: false, status_operacional: "SEM_STATUS" });
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(false);
    expect(c?.precisaRegularizarDisponibilidade).toBe(true);
  });

  it("ativo COM registro em MANUTENCAO não permite interno, mas permite reserva com previsão", () => {
    const c = cand({ status_operacional: "MANUTENCAO", previsao_liberacao: "2026-08-10" });
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(true);
    expect(c?.precisaRegularizarDisponibilidade).toBe(false);
  });
});

describe("G0 — mapeamento do erro CT2_DISPONIBILIDADE_SEM_REGISTRO", () => {
  it("é determinístico (não incerto) e traz mensagem acionável", () => {
    const n = normalizeCt2Error(new Error("CT2_DISPONIBILIDADE_SEM_REGISTRO"));
    expect(n.code).toBe("CT2_DISPONIBILIDADE_SEM_REGISTRO");
    expect(n.isUncertain).toBe(false);
    expect(n.message).toMatch(/disponibilidade operacional/i);
    expect(n.message).not.toMatch(/select|insert|pgrst|sql/i);
  });
});

describe("G2 — invalidação por prefixo", () => {
  it("reconhece as chaves operacionais e ignora as demais", () => {
    expect(chaveEhAtivoOperacional(["central-transporte-analise", "item-1", null])).toBe(true);
    expect(chaveEhAtivoOperacional(["ativos-reconciliados"])).toBe(true);
    expect(chaveEhAtivoOperacional(["veiculos", { page: 2 }])).toBe(true);
    expect(chaveEhAtivoOperacional(["status-operacional-map"])).toBe(true);
    expect(chaveEhAtivoOperacional(["funcionarios"])).toBe(false);
    expect(chaveEhAtivoOperacional("veiculos")).toBe(false);
  });

  it("invalida por predicate, não por chave exata", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    await invalidarCachesAtivosOperacionais({ invalidateQueries } as never);
    const arg = invalidateQueries.mock.calls[0][0] as {
      predicate: (q: { queryKey: unknown }) => boolean;
    };
    expect(typeof arg.predicate).toBe("function");
    expect(arg.predicate({ queryKey: ["central-transporte", "filtro-x"] })).toBe(true);
    expect(arg.predicate({ queryKey: ["diarias"] })).toBe(false);
  });

  /**
   * Homologação CT-2 — as telas de ativos e da Central consomem estas raízes de
   * queryKey; todas precisam ser cobertas pela invalidação operacional.
   */
  it("cobre todas as raízes de queryKey operacionais das telas de ativos/Central", () => {
    const raizesOperacionais = [
      "ativos-reconciliados",
      "disponibilidades",
      "status-operacional-map",
      "estado-operacional-ativo",
      "veiculos",
      "equipamentos-dd",
      "mapa-operacional",
      "central-transporte",
      "central-transporte-analise",
      "central-transporte-atendimentos",
    ];
    for (const raiz of raizesOperacionais) {
      expect(chaveEhAtivoOperacional([raiz, "qualquer-filtro"])).toBe(true);
    }
  });
});

describe("G1 — regularização passa exclusivamente pela RPC", () => {
  const ler = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  it("o serviço de regularização não escreve direto na tabela de disponibilidade", () => {
    const src = ler("src/services/centralTransporteDisponibilidadeService.ts");
    expect(src).toContain("fn_ct_disponibilidade_upsert");
    expect(src).not.toMatch(/\.from\(\s*["']bd_disponibilidade_equipamentos["']\s*\)/);
  });

  it("o modal da Central delega ao fluxo único de upsert, sem escrita direta", () => {
    const src = ler("src/components/central-transporte/RegularizarDisponibilidadeModal.tsx");
    expect(src).toContain("DisponibilidadeAtivoModal");
    expect(src).not.toMatch(/\.from\(\s*["']bd_disponibilidade_equipamentos["']\s*\)/);
  });

  it("o modal compartilhado grava via RPC e invalida os caches operacionais", () => {
    const src = ler("src/components/disponibilidade/DisponibilidadeUpsertModal.tsx");
    expect(src).toContain("regularizarDisponibilidade");
    expect(src).toContain("invalidarCachesAtivosOperacionais");
    expect(src).not.toMatch(/\.from\(\s*["']bd_disponibilidade_equipamentos["']\s*\)/);
  });
});

