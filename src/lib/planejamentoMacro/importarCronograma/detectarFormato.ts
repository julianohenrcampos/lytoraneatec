// Fase 7A — Detector de formato de arquivo de cronograma.
// Sem dependência do parser CSV/XLSX (evita ciclo).

export type FormatoCronograma =
  | "xml_msproject_nativo"
  | "csv_com_xml_cru"
  | "xlsx_plano"
  | "csv_plano";

const PK_HEADER = [0x50, 0x4b, 0x03, 0x04];

function temAssinaturaPK(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === PK_HEADER[0] &&
    bytes[1] === PK_HEADER[1] &&
    bytes[2] === PK_HEADER[2] &&
    bytes[3] === PK_HEADER[3]
  );
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/**
 * Decide o formato sem alterar o conteúdo.
 * Ordem: XML nativo → CSV com XML cru embutido → XLSX (PK ou extensão) → CSV plano.
 */
export function detectarFormato(args: {
  bytes: Uint8Array;
  texto: string;
  nomeArquivo: string;
}): FormatoCronograma {
  const { bytes, texto, nomeArquivo } = args;
  const nome = nomeArquivo.toLowerCase();
  const ext = nome.split(".").pop() ?? "";

  const head = stripBom(texto).trimStart();

  // 1) XML nativo — exige que <?xml seja seguido de espaço/atributo, não vírgula
  //    (do contrário pode ser CSV colunado começando com a string "<?xml").
  if (/^<\?xml[\s?]/i.test(head)) {
    return "xml_msproject_nativo";
  }

  // 2) CSV com XML cru embutido — busca por marcadores típicos do MSP.
  //    Inclui o caso "colunado": cada linha do XML quebrada em colunas CSV,
  //    onde <?xml ou <Project aparecem como primeira coluna seguidos de vírgula.
  if (
    /<Project\b[^>]*xmlns=/i.test(texto) ||
    /<Tasks>\s*<Task>/i.test(texto) ||
    /(^|\n)\s*<\?xml\s*,/i.test(texto) ||
    /(^|\n)\s*<Project\s*,/i.test(texto)
  ) {
    return "csv_com_xml_cru";
  }

  // 3) XLSX por assinatura ZIP ou extensão
  if (ext === "xlsx" || ext === "xls" || temAssinaturaPK(bytes)) {
    return "xlsx_plano";
  }

  // 4) CSV plano (default)
  return "csv_plano";
}
