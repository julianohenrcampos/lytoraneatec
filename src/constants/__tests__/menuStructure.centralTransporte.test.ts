/**
 * CT-2 / M4 — Gate de navegação da Central do Transporte.
 * O item de menu deve usar a nova permission e exigir a action `visualizar`.
 */
import { describe, it, expect } from "vitest";
import { menuStructure } from "@/constants/menuStructure";
import { ROUTE_PERMISSIONS } from "@/constants/routePermissions";
import { CT_PERMISSION } from "@/hooks/central-transporte/useCentralTransporteCapabilities";

type MenuItem = {
  name: string;
  href: string;
  requiredPermission?: string;
  requiredAction?: string;
};

const allItems: MenuItem[] = menuStructure.flatMap((g) => g.items as MenuItem[]);
const item = allItems.find((i) => i.href === "/gestao-maquinas/central-transporte");

describe("menuStructure — Central do Transporte (CT-2/M4)", () => {
  it("possui exatamente um item de navegação para a rota", () => {
    const matches = allItems.filter((i) => i.href === "/gestao-maquinas/central-transporte");
    expect(matches).toHaveLength(1);
  });

  it("usa a permission dedicada da Central do Transporte", () => {
    expect(item?.requiredPermission).toBe(CT_PERMISSION);
  });

  it("não mantém a permission antiga gestao_maquinas_caminhoes_view", () => {
    expect(item?.requiredPermission).not.toBe("gestao_maquinas_caminhoes_view");
  });

  it("exige a action visualizar", () => {
    expect(item?.requiredAction).toBe("visualizar");
  });

  it("routePermissions mapeia a rota para a mesma permission", () => {
    expect(
      (ROUTE_PERMISSIONS as unknown as Record<string, readonly string[]>)["/gestao-maquinas/central-transporte"],
    ).toEqual([CT_PERMISSION]);
  });
});
