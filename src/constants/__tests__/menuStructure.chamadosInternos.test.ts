import { describe, it, expect } from "vitest";
import { menuStructure } from "@/constants/menuStructure";

const findGroup = (title: string) =>
  menuStructure.find((g) => g.title === title);

describe("menuStructure — chamados internos", () => {
  it("possui uma seção independente 'Chamados Internos'", () => {
    const group = findGroup("Chamados Internos");
    expect(group).toBeDefined();
    expect(group!.items).toHaveLength(5);
  });

  it("possui os quatro itens com hrefs e permissions canônicas", () => {
    const group = findGroup("Chamados Internos")!;
    const byHref = Object.fromEntries(group.items.map((i) => [i.href, i]));

    expect(byHref["/chamados-internos"].requiredPermission).toBe(
      "chamados_internos_view",
    );
    expect(byHref["/chamados-internos"].name).toBe("Meus Chamados");

    expect(byHref["/chamados-internos/abrir"].requiredPermission).toBe(
      "chamados_internos_abrir",
    );
    expect(byHref["/chamados-internos/abrir"].name).toBe("Abrir Chamado");

    expect(byHref["/chamados-internos/atendimento"].requiredPermission).toBe(
      "chamados_internos_atender",
    );
    expect(byHref["/chamados-internos/atendimento"].name).toBe("Atendimento");

    expect(byHref["/chamados-internos/admin"].requiredPermission).toBe(
      "chamados_internos_admin",
    );
    expect(byHref["/chamados-internos/admin"].name).toBe("Administração");
  });

  it("não inclui a rota de detalhe no menu", () => {
    const group = findGroup("Chamados Internos")!;
    const hrefs = group.items.map((i) => i.href);
    expect(hrefs.some((h) => h.includes(":chamadoId"))).toBe(false);
  });

  it("não usa customAccessKey nesta seção", () => {
    const group = findGroup("Chamados Internos")!;
    for (const item of group.items) {
      expect((item as { customAccessKey?: string }).customAccessKey).toBeUndefined();
    }
  });

  it("preserva o item 'Chamados e OS' existente em 'Gestão Veic/Equip'", () => {
    const group = findGroup("Gestão Veic/Equip");
    expect(group).toBeDefined();
    const chamadosOs = group!.items.find(
      (i) => i.href === "/requisicoes/chamados-os",
    );
    expect(chamadosOs).toBeDefined();
    expect(chamadosOs!.name).toBe("Chamados e OS");
    expect(chamadosOs!.requiredPermission).toBe("requisicoes_chamados_os_view");
  });
});
