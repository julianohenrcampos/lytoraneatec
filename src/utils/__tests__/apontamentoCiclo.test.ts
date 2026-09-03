import { describe, it, expect } from "vitest";
import { derivarCicloApontamento } from "../apontamentoCiclo";

describe("derivarCicloApontamento", () => {
  it("EM_ANDAMENTO quando ambos nulos", () => {
    expect(derivarCicloApontamento({ hora_final: null, horimetro_final: null })).toBe("EM_ANDAMENTO");
    expect(derivarCicloApontamento({ hora_final: "", horimetro_final: null })).toBe("EM_ANDAMENTO");
  });

  it("FINALIZADO quando ambos preenchidos", () => {
    expect(derivarCicloApontamento({ hora_final: "17:00", horimetro_final: 123.4 })).toBe("FINALIZADO");
  });

  it("INCONSISTENTE quando apenas um preenchido", () => {
    expect(derivarCicloApontamento({ hora_final: "17:00", horimetro_final: null })).toBe("INCONSISTENTE");
    expect(derivarCicloApontamento({ hora_final: null, horimetro_final: 12 })).toBe("INCONSISTENTE");
  });
});
