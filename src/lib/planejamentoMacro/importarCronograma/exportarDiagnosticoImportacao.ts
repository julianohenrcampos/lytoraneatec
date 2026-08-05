// Fase 6H.1.2 / 6I.2-B — Exporta diagnóstico da importação como XLSX (9 abas).
// 100% client-side. Sem campos financeiros (custo/valor/preço).

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type {
  CentroCustoSelecionado,
  FamiliaRecurso,
  ResultadoParse,
} from "./tipos";

type AOA = (string | number | null)[][];

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function timestampArquivo(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function timestampLegivel(d: Date): string {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function abaResumo(
  r: ResultadoParse,
  cc: CentroCustoSelecionado,
  geradoEm: Date,
): AOA {
  const rec = r.recursos;
  const rows: AOA = [
    ["Diagnóstico de importação — Planejamento Macro (Fase 6I.2-B)", ""],
    ["", ""],
    ["Arquivo", r.nomeArquivo],
    [
      "Centro de Custo selecionado",
      `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
    ],
    [
      "Período identificado",
      r.periodo.inicio && r.periodo.fim
        ? `${fmtData(r.periodo.inicio)} → ${fmtData(r.periodo.fim)}`
        : "—",
    ],
    ["Total de linhas no arquivo", r.totalLinhas],
    ["", ""],
    ["Atividades válidas", r.resumo.validas],
    ["Atividades ignoradas", r.resumo.ignoradas],
    ["Atividades com erro", r.resumo.comErro],
    ["", ""],
    ["Catálogo de Recursos — total", rec?.catalogo.total ?? 0],
  ];
  if (rec?.catalogo.porGrupo) {
    rows.push(["  Por grupo", ""]);
    for (const [g, n] of Object.entries(rec.catalogo.porGrupo)) {
      rows.push([`    ${g}`, n]);
    }
  }
  if (rec?.catalogo.porFamilia) {
    rows.push(["  Por família", ""]);
    for (const [f, n] of Object.entries(rec.catalogo.porFamilia)) {
      rows.push([`    ${f}`, n]);
    }
  }
  rows.push(
    ["", ""],
    ["INSUMOS — MOD/MOI detectados (operacional)", rec?.detectadasMaoObra ?? 0],
    ["INSUMOS — Mapeados (serão gravados)", rec?.mapeados ?? 0],
    ["INSUMOS — Sem função em bd_funcoes", rec?.semFuncao ?? 0],
    ["INSUMOS — Sem atividade correspondente", rec?.semAtividade ?? 0],
    ["INSUMOS — Ambíguos", rec?.ambiguos ?? 0],
    ["INSUMOS — Fora de escopo (SE/desconhecida)", rec?.ignoradasPorFamilia ?? 0],
    ["", ""],
    ["Diagnóstico não persistido — total atribuições (EQ/MAT/SUB/ADM)", rec?.diagnosticoNaoPersistido.total ?? 0],
    ["Diagnóstico não persistido — horas", rec?.diagnosticoNaoPersistido.horas ?? 0],
  );
  if (rec?.diagnosticoNaoPersistido.porFamilia) {
    for (const [f, n] of Object.entries(rec.diagnosticoNaoPersistido.porFamilia)) {
      rows.push([`  ${f}`, n]);
    }
  }
  rows.push(
    ["", ""],
    ["FATURAMENTO — atribuições (referência)", rec?.faturamento.atribuicoes ?? 0],
    ["FATURAMENTO — recursos no catálogo", rec?.faturamento.recursosCatalogo ?? 0],
    ["FATURAMENTO — horas", rec?.faturamento.horas ?? 0],
    ["", ""],
    ["Divergências família catálogo × atribuição", rec?.divergenciasFamilia.length ?? 0],
    ["Suspeitas de classificação", rec?.suspeitasClassificacao.length ?? 0],
    ["", ""],
    ["Data/hora da exportação", timestampLegivel(geradoEm)],
  );
  return rows;
}

function abaCatalogoRecursos(r: ResultadoParse): AOA {
  const rows: AOA = [
    [
      "Linha",
      "UID Recurso",
      "ID Recurso",
      "Nome do recurso",
      "Grupo (bruto)",
      "Grupo efetivo",
      "Família (bruta)",
      "Família efetiva",
      "Unidade",
      "Observações",
    ],
  ];
  for (const c of r.recursosCatalogo) {
    rows.push([
      c.linhaOriginal,
      c.uidRecurso ?? "",
      c.idRecurso ?? "",
      c.nomeRecurso,
      c.grupoBruto ?? "",
      c.grupo,
      c.familiaBruta ?? "",
      c.familia,
      c.unidadeMedida ?? "",
      c.observacoes ?? "",
    ]);
  }
  return rows;
}

function abaAtribuicoesOperacional(r: ResultadoParse): AOA {
  const rows: AOA = [
    [
      "Linha",
      "Atividade",
      "EAP/WBS",
      "Nome do recurso",
      "Função mapeada",
      "Grupo",
      "Família declarada",
      "Família efetiva",
      "Trabalho (h)",
      "Unidades",
    ],
  ];
  const ativPorLinha = new Map<number, { nome: string; wbs: string | null }>();
  for (const a of r.atividades) {
    ativPorLinha.set(a.linhaOriginal, { nome: a.nome, wbs: a.codigo_wbs });
  }
  for (const a of r.alocacoes) {
    if (a.motivoIgnorado !== null) continue;
    if (a.funcaoId === null) continue;
    if (a.familiaEfetiva !== "MOD" && a.familiaEfetiva !== "MOI") continue;
    const ativ = a.vinculoAtividadeLinha
      ? ativPorLinha.get(a.vinculoAtividadeLinha)
      : null;
    rows.push([
      a.linhaOriginal,
      ativ?.nome ?? "",
      ativ?.wbs ?? "",
      a.nomeRecurso ?? "",
      a.funcaoNomeResolvido ?? "",
      a.grupo,
      a.familiaDeclarada,
      a.familiaEfetiva,
      a.trabalhoHoras ?? "",
      a.unidades ?? "",
    ]);
  }
  return rows;
}

function abaAtribuicoesDiagnostico(r: ResultadoParse): AOA {
  const rows: AOA = [
    [
      "Linha",
      "Nome Tarefa",
      "EAP/WBS",
      "Nome do recurso",
      "Grupo",
      "Família declarada",
      "Família efetiva",
      "Divergência família",
      "Trabalho (h)",
      "Unidades",
      "Observação",
    ],
  ];
  for (const a of r.alocacoes) {
    if (a.motivoIgnorado !== "familia_nao_persistida_fase") continue;
    rows.push([
      a.linhaOriginal,
      a.nomeTarefa ?? "",
      a.wbsTarefa ?? "",
      a.nomeRecurso ?? "",
      a.grupo,
      a.familiaDeclarada,
      a.familiaEfetiva,
      a.divergenciaFamilia ? "Sim" : "Não",
      a.trabalhoHoras ?? "",
      a.unidades ?? "",
      "Diagnóstico — não persistido nesta fase",
    ]);
  }
  return rows;
}

function abaAtribuicoesFaturamento(r: ResultadoParse): AOA {
  const rows: AOA = [
    [
      "Linha",
      "Nome Tarefa",
      "EAP/WBS",
      "Nome do recurso",
      "Família efetiva",
      "Trabalho (h)",
      "Unidades",
      "Observação",
    ],
  ];
  for (const a of r.alocacoes) {
    if (a.motivoIgnorado !== "grupo_faturamento") continue;
    rows.push([
      a.linhaOriginal,
      a.nomeTarefa ?? "",
      a.wbsTarefa ?? "",
      a.nomeRecurso ?? "",
      a.familiaEfetiva,
      a.trabalhoHoras ?? "",
      a.unidades ?? "",
      "Referência — nunca persistido",
    ]);
  }
  return rows;
}

function abaFuncoesNaoMapeadas(r: ResultadoParse): AOA {
  const rows: AOA = [
    [
      "Nome do recurso",
      "Ocorrências",
      "Famílias encontradas",
      "Classificação sugerida",
      "Ação recomendada",
      "Observação",
    ],
  ];
  const rec = r.recursos;
  if (!rec || rec.funcoesNaoMapeadas.length === 0) return rows;

  const familiasPorNome = new Map<string, Set<FamiliaRecurso>>();
  for (const a of r.alocacoes) {
    if (!a.nomeRecurso) continue;
    const set = familiasPorNome.get(a.nomeRecurso) ?? new Set<FamiliaRecurso>();
    set.add(a.familiaEfetiva);
    familiasPorNome.set(a.nomeRecurso, set);
  }
  for (const f of rec.funcoesNaoMapeadas) {
    const fams = Array.from(familiasPorNome.get(f.nomeRecurso) ?? []);
    const famsStr = fams.length ? fams.join(", ") : "—";
    const apenasMaoObra = fams.length > 0 && fams.every((x) => x === "MOD" || x === "MOI");
    const temEquipamento = fams.includes("EQ");
    const temMaterial = fams.includes("MAT");
    let sugestao = "";
    let acao = "";
    if (apenasMaoObra) {
      sugestao = "Provável função de mão de obra";
      acao = "Verificar cadastro em bd_funcoes (situação Ativo, nome exato)";
    } else if (temEquipamento) {
      sugestao = "Possível equipamento classificado como mão de obra";
      acao = "Corrigir família no cronograma (mover para EQ)";
    } else if (temMaterial) {
      sugestao = "Possível material classificado como mão de obra";
      acao = "Corrigir família no cronograma (mover para MAT)";
    } else {
      sugestao = "";
      acao = "Revisar manualmente";
    }
    rows.push([f.nomeRecurso, f.ocorrencias, famsStr, sugestao, acao, ""]);
  }
  return rows;
}

function abaAlocacoesSemAtividade(r: ResultadoParse): AOA {
  const rows: AOA = [
    ["UID Tarefa", "ID Tarefa", "WBS", "Nome Tarefa", "Nome Recurso", "Família efetiva", "Trabalho (h)", "Unidades", "Motivo"],
  ];
  for (const a of r.alocacoes) {
    if (a.motivoIgnorado !== "sem_atividade" && a.motivoIgnorado !== "ambiguo") continue;
    rows.push([
      a.uidTarefa ?? "",
      a.idTarefa ?? "",
      a.wbsTarefa ?? "",
      a.nomeTarefa ?? "",
      a.nomeRecurso ?? "",
      a.familiaEfetiva,
      a.trabalhoHoras ?? "",
      a.unidades ?? "",
      a.motivoIgnorado === "ambiguo" ? "Ambíguo (múltiplas atividades)" : "Sem atividade correspondente",
    ]);
  }
  return rows;
}

function abaDivergencias(r: ResultadoParse): AOA {
  const rows: AOA = [["Linha", "Nome Recurso", "Família declarada (atribuição)", "Família efetiva (catálogo)"]];
  const rec = r.recursos;
  if (!rec) return rows;
  for (const d of rec.divergenciasFamilia) {
    rows.push([d.linha, d.nomeRecurso, d.declarada, d.efetiva]);
  }
  return rows;
}

function abaSuspeitas(r: ResultadoParse): AOA {
  const rows: AOA = [["Linha", "Nome Recurso", "Família informada", "Família sugerida", "Motivo", "Observação"]];
  const rec = r.recursos;
  if (!rec) return rows;
  for (const s of rec.suspeitasClassificacao) {
    rows.push([s.linha, s.nomeRecurso, s.familiaInformada, s.familiaSugerida, s.motivo, "Alerta — nenhum dado é alterado automaticamente"]);
  }
  return rows;
}

export function exportarDiagnosticoImportacao(
  resultado: ResultadoParse,
  cc: CentroCustoSelecionado,
): void {
  const geradoEm = new Date();
  const wb = XLSX.utils.book_new();

  const sheets: Array<{ name: string; rows: AOA }> = [
    { name: "Resumo", rows: abaResumo(resultado, cc, geradoEm) },
    { name: "Catálogo de Recursos", rows: abaCatalogoRecursos(resultado) },
    { name: "INSUMOS operacional", rows: abaAtribuicoesOperacional(resultado) },
    { name: "Diagnóstico EQ-MAT-SUB-ADM", rows: abaAtribuicoesDiagnostico(resultado) },
    { name: "FATURAMENTO", rows: abaAtribuicoesFaturamento(resultado) },
    { name: "Funções não mapeadas", rows: abaFuncoesNaoMapeadas(resultado) },
    { name: "Alocações sem atividade", rows: abaAlocacoesSemAtividade(resultado) },
    { name: "Divergências família", rows: abaDivergencias(resultado) },
    { name: "Suspeitas classificação", rows: abaSuspeitas(resultado) },
  ];

  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const nomeArquivo = `diagnostico-importacao-${cc.codigo_centro_custo}-${timestampArquivo(geradoEm)}.xlsx`;
  saveAs(blob, nomeArquivo);
}
