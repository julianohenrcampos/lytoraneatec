import { describe, it, expect } from "vitest";
import {
  normalizarDataMsProject,
  durationIsoParaHoras,
} from "../normalizarDataMsProject";

describe("normalizarDataMsProject", () => {
  it("extrai YYYY-MM-DD sem retroceder por fuso", () => {
    expect(normalizarDataMsProject("2026-06-16T08:00:00")).toBe("2026-06-16");
    expect(normalizarDataMsProject("2026-06-16T23:59:00")).toBe("2026-06-16");
    expect(normalizarDataMsProject("2026-06-16")).toBe("2026-06-16");
    expect(normalizarDataMsProject("2026-06-16T00:00:00Z")).toBe("2026-06-16");
  });
  it("retorna null para inválidos", () => {
    expect(normalizarDataMsProject(null)).toBeNull();
    expect(normalizarDataMsProject("")).toBeNull();
    expect(normalizarDataMsProject("xxx")).toBeNull();
    expect(normalizarDataMsProject("0000-13-40")).toBeNull();
  });
});

describe("durationIsoParaHoras", () => {
  it("converte PT#H#M#S para horas decimais", () => {
    expect(durationIsoParaHoras("PT8H0M0S")).toBe(8);
    expect(durationIsoParaHoras("PT0H30M0S")).toBe(0.5);
    expect(durationIsoParaHoras("PT2H15M0S")).toBe(2.25);
    expect(durationIsoParaHoras("PT0H0M0S")).toBe(0);
  });
  it("aceita número puro como horas", () => {
    expect(durationIsoParaHoras("4")).toBe(4);
    expect(durationIsoParaHoras("0")).toBe(0);
  });
  it("retorna null para vazio/nulo", () => {
    expect(durationIsoParaHoras(null)).toBeNull();
    expect(durationIsoParaHoras("")).toBeNull();
  });
});
