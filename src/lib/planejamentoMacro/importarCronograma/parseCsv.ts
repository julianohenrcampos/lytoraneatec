// Fase 6F — Parser CSV via papaparse. 100% client-side.

import Papa from "papaparse";
import { construirPreview } from "./validar";
import type { CentroCustoSelecionado, ResultadoParse } from "./tipos";

export async function parseCsvParaPreview(
  file: File,
  cc: CentroCustoSelecionado
): Promise<ResultadoParse> {
  const texto = await file.text();
  return new Promise<ResultadoParse>((resolve) => {
    Papa.parse<Record<string, unknown>>(texto, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const headers = (result.meta.fields ?? []).map((h) => h.trim());
        const linhas = (result.data ?? []).filter(
          (r) => r && typeof r === "object" && Object.values(r).some((v) => v !== null && v !== "")
        );
        resolve(
          construirPreview({
            formato: "csv",
            origem: "importacao_csv",
            nomeArquivo: file.name,
            linhas,
            cabecalhos: headers,
            cc,
          })
        );
      },
      error: () => {
        resolve(
          construirPreview({
            formato: "csv",
            origem: "importacao_csv",
            nomeArquivo: file.name,
            linhas: [],
            cabecalhos: [],
            cc,
          })
        );
      },
    });
  });
}
