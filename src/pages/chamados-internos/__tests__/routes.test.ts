import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APP_TSX = readFileSync(resolve(__dirname, "../../../App.tsx"), "utf-8");

describe("App.tsx — rotas de Chamados Internos", () => {
  it.each([
    ["/chamados-internos", "chamados_internos_view", "ChamadosInternosList"],
    ["/chamados-internos/abrir", "chamados_internos_abrir", "ChamadosInternosAbrir"],
    ["/chamados-internos/atendimento", "chamados_internos_atender", "ChamadosInternosAtendimento"],
    ["/chamados-internos/admin", "chamados_internos_admin", "ChamadosInternosAdmin"],
    ["/chamados-internos/:chamadoId", "chamados_internos_view", "ChamadoInternoDetalhe"],
  ])("registra rota %s com permission %s e componente %s", (path, permission, component) => {
    const re = new RegExp(
      `path="${path.replace(/[/:]/g, (c) => "\\" + c)}"[\\s\\S]{0,400}Secure permission="${permission}"[\\s\\S]{0,200}<${component}\\s*/>`,
    );
    expect(APP_TSX).toMatch(re);
  });

  it("não registra mais a rota /chamados-internos/fluxo", () => {
    expect(APP_TSX).not.toMatch(/\/chamados-internos\/fluxo/);
    expect(APP_TSX).not.toMatch(/ChamadosInternosFluxo/);
  });

  it("usa <Secure> (não <Perm>/<Auth>) em todas as rotas do módulo", () => {
    const routes = [
      "/chamados-internos",
      "/chamados-internos/abrir",
      "/chamados-internos/atendimento",
      "/chamados-internos/admin",
      "/chamados-internos/:chamadoId",
    ];
    for (const p of routes) {
      const escaped = p.replace(/[/:]/g, (c) => "\\" + c);
      const re = new RegExp(`path="${escaped}"[^>]*element=\\{<Secure`);
      expect(APP_TSX).toMatch(re);
    }
  });
});
