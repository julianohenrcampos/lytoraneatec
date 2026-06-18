import { describe, it, expect } from "vitest";
import { recuperarXmlDeCsv } from "../recuperarXmlDeCsv";

describe("recuperarXmlDeCsv", () => {
  it("extrai XML envelopado em aspas duplas", () => {
    const csv = `header\n"<?xml version=""1.0""?><Project><Tasks></Tasks></Project>"`;
    const r = recuperarXmlDeCsv(csv);
    expect(r.xml).not.toBeNull();
    expect(r.xml!).toContain("<Project>");
    expect(r.xml!).toContain("</Project>");
  });

  it("retorna aviso quando </Project> ausente", () => {
    const csv = `<?xml version="1.0"?><Project><Tasks>`;
    const r = recuperarXmlDeCsv(csv);
    expect(r.xml).toBeNull();
    expect(r.aviso).toMatch(/truncado/i);
  });

  it("retorna aviso quando não há marcador XML", () => {
    const r = recuperarXmlDeCsv("a,b,c\n1,2,3");
    expect(r.xml).toBeNull();
    expect(r.aviso).toMatch(/marcador/i);
  });

  it("garante declaração XML se faltar", () => {
    const csv = `<Project xmlns="x"><Tasks></Tasks></Project>`;
    const r = recuperarXmlDeCsv(csv);
    expect(r.xml).not.toBeNull();
    expect(r.xml!.startsWith("<?xml")).toBe(true);
  });

  it("reconstrói XML do MS Project colunado por CSV (caso real M102)", () => {
    const csv =
      `<?xml,"version=""1.0""","encoding=""UTF-8""","standalone=""yes""?>"\n` +
      `<Project,"xmlns=""http://schemas.microsoft.com/project"">"\n` +
      `\t<Name>M102,-,RIO,ACARI,-,CRONOGRAMA,-,ITENS,SCO.xml</Name>\n` +
      `</Project>`;
    const r = recuperarXmlDeCsv(csv);
    expect(r.xml).not.toBeNull();
    const xml = r.xml!;
    expect(xml).toMatch(/^<\?xml\s+version="1\.0"\s+encoding="UTF-8"\s+standalone="yes"\?>/);
    expect(xml).toContain('<Project xmlns="http://schemas.microsoft.com/project">');
    expect(xml).toContain("<Name>M102 - RIO ACARI - CRONOGRAMA - ITENS SCO.xml</Name>");
    expect(xml).not.toMatch(/<\?xml\s*,/);
    expect(xml).not.toMatch(/<Project\s*,/);
  });
});
