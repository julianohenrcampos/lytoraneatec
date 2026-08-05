import { describe, it, expect } from "vitest";
import { detectarFormato } from "../detectarFormato";

function bytesOf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("detectarFormato", () => {
  it("detecta XML nativo", () => {
    const t = `<?xml version="1.0" encoding="UTF-8"?>\n<Project xmlns="x"></Project>`;
    expect(detectarFormato({ bytes: bytesOf(t), texto: t, nomeArquivo: "plano.xml" })).toBe(
      "xml_msproject_nativo",
    );
  });
  it("detecta CSV com XML cru via tag Project xmlns", () => {
    const t = `coluna1,coluna2\n"valor","<Project xmlns=\\"x\\"><Tasks></Tasks></Project>"`;
    expect(detectarFormato({ bytes: bytesOf(t), texto: t, nomeArquivo: "plano.csv" })).toBe(
      "csv_com_xml_cru",
    );
  });
  it("detecta XLSX por assinatura PK", () => {
    const arr = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(detectarFormato({ bytes: arr, texto: "", nomeArquivo: "plano.bin" })).toBe(
      "xlsx_plano",
    );
  });
  it("detecta XLSX por extensão", () => {
    expect(
      detectarFormato({ bytes: bytesOf("x"), texto: "x", nomeArquivo: "plano.xlsx" }),
    ).toBe("xlsx_plano");
  });
  it("default = CSV plano", () => {
    const t = "wbs,nome,inicio,fim\n1,A,2026-01-01,2026-01-02";
    expect(detectarFormato({ bytes: bytesOf(t), texto: t, nomeArquivo: "plano.csv" })).toBe(
      "csv_plano",
    );
  });
  it("aceita BOM e whitespace antes de <?xml", () => {
    const t = "\uFEFF\n  <?xml version=\"1.0\"?>\n<Project></Project>";
    expect(detectarFormato({ bytes: bytesOf(t), texto: t, nomeArquivo: "x.xml" })).toBe(
      "xml_msproject_nativo",
    );
  });
  it("detecta CSV com XML do MS Project colunado (caso M102)", () => {
    const t =
      `<?xml,"version=""1.0""","encoding=""UTF-8""","standalone=""yes""?>"\n` +
      `<Project,"xmlns=""http://schemas.microsoft.com/project"">"\n` +
      `\t<Name>M102,-,RIO</Name>`;
    expect(detectarFormato({ bytes: bytesOf(t), texto: t, nomeArquivo: "M102.csv" })).toBe(
      "csv_com_xml_cru",
    );
  });
});
