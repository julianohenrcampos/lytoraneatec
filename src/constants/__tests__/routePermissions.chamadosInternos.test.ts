import { describe, it, expect } from "vitest";
import {
  ROUTE_PERMISSIONS,
  getRoutePermissions,
  hasRoutePermission,
} from "@/constants/routePermissions";

describe("routePermissions — chamados internos", () => {
  it("mapeia as cinco rotas com as permissions canônicas", () => {
    const map = ROUTE_PERMISSIONS as Record<string, readonly string[]>;
    expect(map["/chamados-internos"]).toEqual(["chamados_internos_view"]);
    expect(map["/chamados-internos/abrir"]).toEqual(["chamados_internos_abrir"]);
    expect(map["/chamados-internos/atendimento"]).toEqual(["chamados_internos_atender"]);
    expect(map["/chamados-internos/admin"]).toEqual(["chamados_internos_admin"]);
    expect(map["/chamados-internos/:chamadoId"]).toEqual(["chamados_internos_view"]);
  });

  it("resolve rota dinâmica de detalhe por UUID", () => {
    const perms = getRoutePermissions(
      "/chamados-internos/550e8400-e29b-41d4-a716-446655440000",
    );
    expect(perms).toEqual(["chamados_internos_view"]);
  });

  it("rota estática /abrir prevalece sobre o padrão dinâmico /:chamadoId", () => {
    expect(getRoutePermissions("/chamados-internos/abrir")).toEqual([
      "chamados_internos_abrir",
    ]);
    expect(getRoutePermissions("/chamados-internos/atendimento")).toEqual([
      "chamados_internos_atender",
    ]);
    expect(getRoutePermissions("/chamados-internos/admin")).toEqual([
      "chamados_internos_admin",
    ]);
  });

  it("barra final não altera o resultado", () => {
    expect(getRoutePermissions("/chamados-internos/abrir/")).toEqual([
      "chamados_internos_abrir",
    ]);
    expect(
      getRoutePermissions("/chamados-internos/550e8400-e29b-41d4-a716-446655440000/"),
    ).toEqual(["chamados_internos_view"]);
  });

  it("rota não mapeada preserva comportamento legado (permitida)", () => {
    expect(getRoutePermissions("/rota-inexistente-xyz")).toEqual([]);
    expect(hasRoutePermission("/rota-inexistente-xyz", [], false)).toBe(true);
  });

  it("hasRoutePermission respeita SuperAdm e wildcard", () => {
    expect(hasRoutePermission("/chamados-internos/admin", [], true)).toBe(true);
    expect(hasRoutePermission("/chamados-internos/admin", ["*"], false)).toBe(true);
    expect(
      hasRoutePermission("/chamados-internos/admin", ["chamados_internos_view"], false),
    ).toBe(false);
    expect(
      hasRoutePermission("/chamados-internos/admin", ["chamados_internos_admin"], false),
    ).toBe(true);
  });

  it("hasRoutePermission resolve rota dinâmica com a permission correta", () => {
    const path = "/chamados-internos/abcdefab-1234-1234-1234-abcdefabcdef";
    expect(hasRoutePermission(path, ["chamados_internos_view"], false)).toBe(true);
    expect(hasRoutePermission(path, ["chamados_internos_admin"], false)).toBe(false);
  });
});
