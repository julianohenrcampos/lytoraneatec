/**
 * Testes unitários do helper puro `getChamadoActionCapabilities` e da
 * tradução de erros de RPC. Cobre a matriz de status × responsabilidade ×
 * permissões × vínculo setorial, com foco em cenários fail-closed.
 */
import { describe, it, expect } from "vitest";
import {
  getChamadoActionCapabilities,
  isRpcForbidden,
  traduzirErroChamado,
  traduzirErroAssumir,
} from "@/utils/chamadosInternosCapabilities";
import type {
  ChamadoCapabilitiesInput,
  ChamadoInternoRow,
} from "@/types/chamadosInternos";

const PROFILE = "prof-1";
const OUTRO_PROFILE = "prof-2";
const FUNC = "func-1";

function chamado(
  partial: Partial<
    Pick<
      ChamadoInternoRow,
      | "status"
      | "setor"
      | "responsavel_atual_profile_id"
      | "aberto_por"
      | "solicitante_funcionario_id"
    >
  > = {},
): ChamadoCapabilitiesInput["chamado"] {
  return {
    status: "em_analise",
    setor: "ti",
    responsavel_atual_profile_id: PROFILE,
    aberto_por: OUTRO_PROFILE,
    solicitante_funcionario_id: FUNC,
    ...partial,
  };
}

function perms(
  overrides: Partial<ChamadoCapabilitiesInput["permissions"]> = {},
): ChamadoCapabilitiesInput["permissions"] {
  return {
    canVisualizarAtendimento: true,
    canEditarAtendimento: true,
    canAdministrarEditar: false,
    canAbrirEditar: false,
    ...overrides,
  };
}

function input(
  overrides: Partial<ChamadoCapabilitiesInput> = {},
): ChamadoCapabilitiesInput {
  return {
    chamado: chamado(),
    profileId: PROFILE,
    funcionarioId: FUNC,
    canAttendSetor: true,
    permissions: perms(),
    ...overrides,
  };
}

describe("getChamadoActionCapabilities", () => {
  it("libera Responder/Solicitar-info/Nota/Resolver quando eu sou o responsável e o status permite", () => {
    const c = getChamadoActionCapabilities(input());
    expect(c.canResponder).toBe(true);
    expect(c.canSolicitarInformacao).toBe(true);
    expect(c.canAdicionarNotaInterna).toBe(true);
    expect(c.canResolver).toBe(true);
    expect(c.showAcoesAtendenteTab).toBe(true);
  });

  it("bloqueia tudo quando não há vínculo ativo no setor (fail-closed)", () => {
    const c = getChamadoActionCapabilities(input({ canAttendSetor: false }));
    expect(c.canAssumir).toBe(false);
    expect(c.canResponder).toBe(false);
    expect(c.canSolicitarInformacao).toBe(false);
    expect(c.canAdicionarNotaInterna).toBe(false);
    expect(c.canResolver).toBe(false);
    expect(c.showAcoesAtendenteTab).toBe(false);
  });

  it("mantém SuperAdm fail-closed quando o backend não confirmou operação", () => {
    const c = getChamadoActionCapabilities(
      input({
        canAttendSetor: false,
        isSuperAdmin: true,
        permissions: perms({
          canVisualizarAtendimento: false,
          canEditarAtendimento: false,
        }),
      }),
    );
    expect(c.canAssumir).toBe(false);
    expect(c.showAcoesAtendenteTab).toBe(false);
  });

  it("libera SuperAdm com capacidade operacional confirmada mesmo sem vínculo/mapping setorial", () => {
    const c = getChamadoActionCapabilities(
      input({
        chamado: chamado({
          status: "aberto",
          responsavel_atual_profile_id: null,
          aberto_por: PROFILE,
        }),
        canAttendSetor: true,
        isSuperAdmin: true,
        permissions: perms({
          canVisualizarAtendimento: false,
          canEditarAtendimento: false,
          canAdministrarEditar: false,
          canAbrirEditar: false,
        }),
      }),
    );
    expect(c.canAssumir).toBe(true);
    expect(c.canCancelar).toBe(true);
    expect(c.showAcoesAtendenteTab).toBe(false);
  });

  it("bloqueia operações quando existe editar mas falta visualizar (fail-closed)", () => {
    const c = getChamadoActionCapabilities(
      input({
        permissions: perms({
          canVisualizarAtendimento: false,
          canEditarAtendimento: true,
        }),
      }),
    );
    expect(c.showAcoesAtendenteTab).toBe(false);
    expect(c.canResponder).toBe(false);
  });

  it("mostra apenas 'Assumir' quando não há responsável e o status é elegível", () => {
    const c = getChamadoActionCapabilities(
      input({
        chamado: chamado({
          status: "aberto",
          responsavel_atual_profile_id: null,
        }),
      }),
    );
    expect(c.canAssumir).toBe(true);
    expect(c.canResponder).toBe(false);
    expect(c.canResolver).toBe(false);
  });

  it("NUNCA mostra 'Assumir' quando outro atendente é responsável", () => {
    const c = getChamadoActionCapabilities(
      input({
        chamado: chamado({
          status: "em_analise",
          responsavel_atual_profile_id: OUTRO_PROFILE,
        }),
      }),
    );
    expect(c.canAssumir).toBe(false);
    expect(c.canResponder).toBe(false);
  });

  it("não mostra 'Assumir' quando eu já sou o responsável (redundante)", () => {
    const c = getChamadoActionCapabilities(
      input({ chamado: chamado({ status: "em_analise" }) }),
    );
    expect(c.canAssumir).toBe(false);
  });

  it("libera Cancelar para o abridor do chamado com abrir/editar", () => {
    const c = getChamadoActionCapabilities(
      input({
        chamado: chamado({
          status: "aberto",
          aberto_por: PROFILE,
          responsavel_atual_profile_id: null,
        }),
        permissions: perms({
          canVisualizarAtendimento: false,
          canEditarAtendimento: false,
          canAbrirEditar: true,
        }),
      }),
    );
    expect(c.canCancelar).toBe(true);
    // Não deve liberar ações de atendente.
    expect(c.showAcoesAtendenteTab).toBe(false);
  });

  it("libera Cancelar para admin mesmo sem vínculo setorial", () => {
    const c = getChamadoActionCapabilities(
      input({
        chamado: chamado({ status: "aberto" }),
        canAttendSetor: false,
        permissions: perms({
          canVisualizarAtendimento: false,
          canEditarAtendimento: false,
          canAdministrarEditar: true,
        }),
      }),
    );
    expect(c.canCancelar).toBe(true);
  });

  it("bloqueia Cancelar em status encerrados", () => {
    const c = getChamadoActionCapabilities(
      input({
        chamado: chamado({ status: "encerrado" }),
        permissions: perms({ canAdministrarEditar: true }),
      }),
    );
    expect(c.canCancelar).toBe(false);
  });

  it("bloqueia Responder em status 'aberto' mesmo com todas as permissões (regra do backend)", () => {
    const c = getChamadoActionCapabilities(
      input({ chamado: chamado({ status: "aberto" }) }),
    );
    expect(c.canResponder).toBe(false);
  });
});

describe("traduzirErroChamado / isRpcForbidden", () => {
  it("reconhece SQLSTATE 42501 como forbidden", () => {
    const err = { code: "42501", message: "permission denied" };
    expect(isRpcForbidden(err)).toBe(true);
    expect(traduzirErroChamado(err)).toMatch(/autorização|vínculo/i);
  });

  it("reconhece a palavra 'forbidden' na mensagem", () => {
    const err = { message: "forbidden: sem vínculo" };
    expect(isRpcForbidden(err)).toBe(true);
  });

  it("traduz 'chamado_ja_atribuido' com mensagem específica", () => {
    const msg = traduzirErroChamado({ message: "chamado_ja_atribuido" });
    expect(msg).toMatch(/atribuído/i);
  });

  it("cai no fallback genérico para erros desconhecidos", () => {
    expect(traduzirErroChamado(new Error("boom"))).toMatch(/tente novamente/i);
  });
});

describe("traduzirErroAssumir", () => {
  it("mapeia 42501 para autorização", () => {
    expect(traduzirErroAssumir({ code: "42501", message: "forbidden" })).toMatch(
      /autorização para assumir/i,
    );
  });
  it("mapeia chamado_ja_atribuido", () => {
    expect(
      traduzirErroAssumir({ code: "55000", message: "chamado_ja_atribuido" }),
    ).toMatch(/já foi assumido/i);
  });
  it("mapeia estado inválido", () => {
    expect(traduzirErroAssumir({ message: "estado_invalido" })).toMatch(
      /estado que permita/i,
    );
  });
  it("mapeia chamado inexistente", () => {
    expect(traduzirErroAssumir({ message: "chamado_inexistente" })).toMatch(
      /não foi encontrado/i,
    );
  });
  it("cai no fallback específico de assumir", () => {
    expect(traduzirErroAssumir(new Error("boom"))).toMatch(
      /não foi possível assumir/i,
    );
  });
  it("nunca expõe termos técnicos", () => {
    const msg = traduzirErroAssumir({ code: "42501", message: "forbidden" });
    expect(msg).not.toMatch(/forbidden|SQLSTATE|42501|fn_chamado_interno/i);
  });
});

describe("encerrar / reabrir — ato do solicitante ou admin", () => {
  it("atendente responsável NÃO pode encerrar (status respondido)", () => {
    const caps = getChamadoActionCapabilities(
      input({
        chamado: chamado({ status: "respondido", responsavel_atual_profile_id: PROFILE }),
        permissions: perms({ canAbrirEditar: false, canAdministrarEditar: false }),
      }),
    );
    expect(caps.canConfirmarEncerramento).toBe(false);
    expect(caps.canReabrir).toBe(false);
    expect(caps.canResolver).toBe(true);
  });

  it("solicitante encerra em respondido/reaberto/resolvido, mas não em em_analise", () => {
    const perm = perms({ canAbrirEditar: true });
    const respondido = getChamadoActionCapabilities(
      input({ chamado: chamado({ status: "respondido", aberto_por: PROFILE }), permissions: perm }),
    );
    expect(respondido.canConfirmarEncerramento).toBe(true);

    const reaberto = getChamadoActionCapabilities(
      input({ chamado: chamado({ status: "reaberto", aberto_por: PROFILE }), permissions: perm }),
    );
    expect(reaberto.canConfirmarEncerramento).toBe(true);

    const emAnalise = getChamadoActionCapabilities(
      input({ chamado: chamado({ status: "em_analise", aberto_por: PROFILE }), permissions: perm }),
    );
    expect(emAnalise.canConfirmarEncerramento).toBe(false);

    const resolvido = getChamadoActionCapabilities(
      input({ chamado: chamado({ status: "resolvido", aberto_por: PROFILE }), permissions: perm }),
    );
    expect(resolvido.canConfirmarEncerramento).toBe(true);
    expect(resolvido.canReabrir).toBe(true);
  });

  it("admin pode encerrar em resolvido e reabrir em encerrado", () => {
    const perm = perms({ canAdministrarEditar: true });
    expect(
      getChamadoActionCapabilities(
        input({ chamado: chamado({ status: "resolvido" }), permissions: perm }),
      ).canConfirmarEncerramento,
    ).toBe(true);
    expect(
      getChamadoActionCapabilities(
        input({ chamado: chamado({ status: "encerrado" }), permissions: perm }),
      ).canReabrir,
    ).toBe(true);
  });
});
