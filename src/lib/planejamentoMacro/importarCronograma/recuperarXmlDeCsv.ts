// Fase 7A — Recupera conteúdo XML cru embutido num arquivo CSV.
// Suporta dois sub-formatos:
//   1) XML cru envelopado em aspas dentro de uma célula CSV (texto contínuo).
//   2) XML do MS Project "colunado" pelo CSV — espaços/vírgulas viraram
//      separadores e cada linha se quebrou em várias colunas. Caso real:
//        <?xml,"version=""1.0""","encoding=""UTF-8""","standalone=""yes""?>"
//        <Project,"xmlns=""http://schemas.microsoft.com/project"">"
//        \t<Name>M102,-,RIO,ACARI,-,CRONOGRAMA,-,ITENS,SCO.xml</Name>
//      Precisamos reconstruir juntando as colunas não-vazias com espaço.

import Papa from "papaparse";

export interface RecuperarXmlResultado {
  xml: string | null;
  aviso?: string;
}

/** Detecta o padrão "XML colunado por CSV" olhando as primeiras linhas. */
function pareceXmlColunado(texto: string): boolean {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\uFEFF/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 6);
  return linhas.some(
    (l) => /^<\?xml\s*,/i.test(l) || /^<Project\s*,/i.test(l),
  );
}

/** Reconstrói XML a partir de CSV colunado usando papaparse. */
function reconstruirDeCsvColunado(texto: string): string {
  const parsed = Papa.parse<string[]>(texto, {
    header: false,
    skipEmptyLines: false,
    // Mantém comportamento padrão de aspas ("" → ")
  });

  const linhasReconstruidas: string[] = [];
  for (const row of parsed.data) {
    if (!Array.isArray(row)) continue;
    const celulas = row
      .map((c) => (c == null ? "" : String(c)))
      .map((c) => c.replace(/\s+$/g, "")) // só trim à direita; preserva indent à esquerda
      .filter((c) => c.trim().length > 0);
    if (celulas.length === 0) {
      linhasReconstruidas.push("");
      continue;
    }
    // Junta colunas com espaço. Isso reconstrói tanto a PI fragmentada
    // (<?xml + version="1.0" + …) quanto o texto interno fragmentado
    // (<Name>M102 + - + RIO + ACARI + … + SCO.xml</Name>).
    linhasReconstruidas.push(celulas.join(" "));
  }
  return linhasReconstruidas.join("\n");
}

export function recuperarXmlDeCsv(textoCsv: string): RecuperarXmlResultado {
  if (!textoCsv) return { xml: null, aviso: "Conteúdo vazio." };

  // 1) Caminho preferencial: XML colunado por CSV (caso real M102).
  if (pareceXmlColunado(textoCsv)) {
    const reconstruido = reconstruirDeCsvColunado(textoCsv);
    const r = extrairXmlDeTexto(reconstruido);
    if (r.xml) return r;
    // Se falhar, cai para o caminho legado.
  }

  // 2) Caminho legado: XML envelopado em aspas dentro de uma célula CSV.
  const aparentementeAspeado =
    /"\s*<\?xml/i.test(textoCsv) || /"\s*<Project\b/i.test(textoCsv);

  let s = textoCsv;
  if (aparentementeAspeado) {
    s = s.replace(/""/g, '"');
  }
  return extrairXmlDeTexto(s);
}

/** Recorta o trecho XML entre <?xml/<Project ...> e </Project>. */
function extrairXmlDeTexto(s: string): RecuperarXmlResultado {
  const idxDecl = s.search(/<\?xml\b/i);
  const idxProj = s.search(/<Project\b/i);
  const inicio = idxDecl >= 0 ? idxDecl : idxProj;
  if (inicio < 0) {
    return { xml: null, aviso: "Nenhum marcador XML encontrado dentro do CSV." };
  }

  const fimMatch = s.slice(inicio).match(/<\/Project>/i);
  if (!fimMatch || fimMatch.index === undefined) {
    return {
      xml: null,
      aviso: "Marcador de início encontrado, mas </Project> ausente — XML truncado.",
    };
  }
  const fim = inicio + fimMatch.index + fimMatch[0].length;

  let xml = s.slice(inicio, fim);
  xml = xml.replace(/^\s*"/, "").replace(/"\s*$/, "");

  if (!/^\s*<\?xml/i.test(xml)) {
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  }

  // Validação mínima: precisa conter <Project após a declaração.
  if (!/<Project\b/i.test(xml)) {
    return { xml: null, aviso: "XML reconstruído não contém <Project>." };
  }

  return { xml };
}
