// Fase 7A — Orquestrador único de importação de cronograma.
// Fluxo: detectarFormato → parser apropriado. Sem dependência circular
// (parseCsv/parseXlsx não conhecem o detector).

import { detectarFormato } from "./detectarFormato";
import { parseCsvParaPreview } from "./parseCsv";
import { parseXlsxParaPreview } from "./parseXlsx";
import { parseMsProjectXml } from "./parseMsProjectXml";
import { recuperarXmlDeCsv } from "./recuperarXmlDeCsv";
import type { CentroCustoSelecionado, ResultadoParse } from "./tipos";

export async function parseCronograma(
  file: File,
  cc: CentroCustoSelecionado,
): Promise<ResultadoParse> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Texto só faz sentido para XML/CSV — para XLSX seria binário, mas o detector
  // checa assinatura PK antes de olhar texto, então decodificar custa pouco.
  let texto = "";
  try {
    texto = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    texto = "";
  }

  const formato = detectarFormato({ bytes, texto, nomeArquivo: file.name });

  switch (formato) {
    case "xml_msproject_nativo": {
      return parseMsProjectXml(texto, {
        cc,
        nomeArquivo: file.name,
        formato: "xml_msproject",
      });
    }
    case "csv_com_xml_cru": {
      const rec = recuperarXmlDeCsv(texto);
      if (!rec.xml) {
        // Cai para CSV plano com aviso (não bloqueia).
        const r = await parseCsvParaPreview(file, cc);
        r.globalWarnings.push(
          rec.aviso
            ? `XML embutido detectado mas não recuperado: ${rec.aviso}`
            : "XML embutido detectado mas não recuperado — tratando como CSV plano.",
        );
        return r;
      }
      return parseMsProjectXml(rec.xml, {
        cc,
        nomeArquivo: file.name,
        formato: "csv_com_xml",
      });
    }
    case "xlsx_plano":
      return parseXlsxParaPreview(file, cc);
    case "csv_plano":
    default:
      return parseCsvParaPreview(file, cc);
  }
}
