import { describe, it, expect } from "vitest";
import { parseMsProjectXml } from "../parseMsProjectXml";

const cc = {
  id: "cc-1",
  codigo_centro_custo: "M102",
  nome_centro_custo: "Rio Acari",
};

const XML_SIMPLES = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <UID>1</UID>
  <Name>Obra M102 - Rio Acari</Name>
  <Author>Engenharia</Author>
  <CreationDate>2026-06-01T08:00:00</CreationDate>
  <StartDate>2026-06-15T08:00:00</StartDate>
  <FinishDate>2026-07-15T17:00:00</FinishDate>
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>188743731</FieldID>
      <FieldName>Text1</FieldName>
      <Alias>Família</Alias>
    </ExtendedAttribute>
  </ExtendedAttributes>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Fase 1 - Mobilização</Name>
      <Start>2026-06-15T08:00:00</Start>
      <Finish>2026-06-20T17:00:00</Finish>
      <WBS>1</WBS>
      <OutlineNumber>1</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
      <Milestone>0</Milestone>
      <Duration>PT40H0M0S</Duration>
      <Work>PT40H0M0S</Work>
      <PercentComplete>0</PercentComplete>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Escavação trecho A</Name>
      <Start>2026-06-16T08:00:00</Start>
      <Finish>2026-06-20T17:00:00</Finish>
      <WBS>1.1</WBS>
      <OutlineNumber>1.1</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <Duration>PT32H0M0S</Duration>
      <Work>PT64H0M0S</Work>
      <PercentComplete>10</PercentComplete>
    </Task>
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>Marco - Fim mobilização</Name>
      <Start>2026-06-20T08:00:00</Start>
      <Finish>2026-06-20T08:00:00</Finish>
      <WBS>1.2</WBS>
      <OutlineNumber>1.2</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>1</Milestone>
      <Duration>PT0H0M0S</Duration>
    </Task>
  </Tasks>
  <Resources>
    <Resource>
      <UID>10</UID>
      <ID>1</ID>
      <Name>OPERADOR DE ESCAVADEIRA</Name>
      <Group>INSUMOS</Group>
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>MOD</Value>
      </ExtendedAttribute>
    </Resource>
    <Resource>
      <UID>11</UID>
      <ID>2</ID>
      <Name>Escavadeira CAT 320</Name>
      <Group>INSUMOS</Group>
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>EQ</Value>
      </ExtendedAttribute>
    </Resource>
  </Resources>
  <Assignments>
    <Assignment>
      <UID>100</UID>
      <TaskUID>2</TaskUID>
      <ResourceUID>10</ResourceUID>
      <Units>1.0</Units>
      <Work>PT32H0M0S</Work>
    </Assignment>
    <Assignment>
      <UID>101</UID>
      <TaskUID>2</TaskUID>
      <ResourceUID>11</ResourceUID>
      <Units>1.0</Units>
      <Work>PT32H0M0S</Work>
    </Assignment>
  </Assignments>
</Project>`;

describe("parseMsProjectXml", () => {
  it("extrai metadados do projeto", () => {
    const r = parseMsProjectXml(XML_SIMPLES, {
      cc,
      nomeArquivo: "M102.xml",
      formato: "xml_msproject",
    });
    expect(r.projetoDetectado?.nome).toContain("M102");
    expect(r.projetoDetectado?.dataInicioProjeto).toBe("2026-06-15");
    expect(r.projetoDetectado?.dataFimProjeto).toBe("2026-07-15");
    expect(r.formato).toBe("xml_msproject");
  });

  it("preserva UID/ID/WBS/OutlineNumber e identifica marco", () => {
    const r = parseMsProjectXml(XML_SIMPLES, {
      cc,
      nomeArquivo: "M102.xml",
      formato: "xml_msproject",
    });
    const escavacao = r.atividades.find((a) => a.nome === "Escavação trecho A");
    expect(escavacao).toBeDefined();
    expect(escavacao!.uidTarefa).toBe("2");
    expect(escavacao!.idTarefa).toBe("2");
    expect(escavacao!.codigo_wbs).toBe("1.1");
    expect(escavacao!.outline_number).toBe("1.1");
    expect(escavacao!.outline_level).toBe(2);
    expect(escavacao!.is_marco).toBe(false);
    expect(escavacao!.duracao_horas).toBe(32);
    expect(escavacao!.trabalho_previsto_horas).toBe(64);

    const marco = r.atividades.find((a) => a.nome.startsWith("Marco"));
    expect(marco?.is_marco).toBe(true);
  });

  it("ignora tarefas de resumo (Summary=1)", () => {
    const r = parseMsProjectXml(XML_SIMPLES, {
      cc,
      nomeArquivo: "M102.xml",
      formato: "xml_msproject",
    });
    const fase = r.atividades.find((a) => a.nome.startsWith("Fase 1"));
    expect(fase?.ignored).toBe(true);
    expect(fase?.is_resumo).toBe(true);
  });

  it("extrai recursos com família resolvida via ExtendedAttribute", () => {
    const r = parseMsProjectXml(XML_SIMPLES, {
      cc,
      nomeArquivo: "M102.xml",
      formato: "xml_msproject",
    });
    expect(r.recursosCatalogo.length).toBe(2);
    const mod = r.recursosCatalogo.find((x) => x.nomeRecurso === "OPERADOR DE ESCAVADEIRA");
    const eq = r.recursosCatalogo.find((x) => x.nomeRecurso === "Escavadeira CAT 320");
    expect(mod?.familia).toBe("MOD");
    expect(eq?.familia).toBe("EQ");
  });

  it("vincula atribuições por TaskUID/ResourceUID", () => {
    const r = parseMsProjectXml(XML_SIMPLES, {
      cc,
      nomeArquivo: "M102.xml",
      formato: "xml_msproject",
    });
    expect(r.alocacoes.length).toBe(2);
    const escav = r.alocacoes.find((a) => a.nomeRecurso === "OPERADOR DE ESCAVADEIRA");
    expect(escav?.uidTarefa).toBe("2");
    expect(escav?.familiaEfetiva).toBe("MOD");
    expect(escav?.trabalhoHoras).toBe(32);
  });

  it("gera aviso quando família não pode ser resolvida", () => {
    const xmlSemFamilia = XML_SIMPLES.replace(
      `<ExtendedAttribute>\n        <FieldID>188743731</FieldID>\n        <Value>EQ</Value>\n      </ExtendedAttribute>`,
      "",
    );
    const r = parseMsProjectXml(xmlSemFamilia, {
      cc,
      nomeArquivo: "M102.xml",
      formato: "xml_msproject",
    });
    expect(r.avisos.some((a) => a.codigo === "FAMILIA_NAO_RESOLVIDA")).toBe(true);
  });

  it("retorna bloqueado com aviso quando XML é inválido", () => {
    const r = parseMsProjectXml("<<<not xml>>>", {
      cc,
      nomeArquivo: "x.xml",
      formato: "xml_msproject",
    });
    expect(r.bloqueado).toBe(true);
  });
});
