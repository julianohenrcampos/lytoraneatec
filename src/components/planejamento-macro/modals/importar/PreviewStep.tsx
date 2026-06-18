import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  FileWarning,
  ChevronDown,
  Info,
  Users2,
  Download,
  Package,
  Wrench,
} from "lucide-react";
import type {
  CentroCustoSelecionado,
  ResultadoParse,
} from "@/lib/planejamentoMacro/importarCronograma/tipos";
import { exportarDiagnosticoImportacao } from "@/lib/planejamentoMacro/importarCronograma/exportarDiagnosticoImportacao";
import { cn } from "@/lib/utils";

interface PreviewStepProps {
  cc: CentroCustoSelecionado;
  resultado: ResultadoParse;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onTrocarArquivo: () => void;
}

const fmt = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const PreviewStep: React.FC<PreviewStepProps> = ({
  cc,
  resultado,
  submitting,
  onCancel,
  onConfirm,
  onTrocarArquivo,
}) => {
  const [mostrarTodas, setMostrarTodas] = React.useState(false);
  const linhas = mostrarTodas ? resultado.atividades : resultado.atividades.slice(0, 20);

  const podeConfirmar = !resultado.bloqueado && resultado.resumo.validas > 0;

  const ccAusente = !resultado.cc.presente && !resultado.cc.divergente;
  const outrosWarnings = resultado.globalWarnings.filter(
    (w) => !/centro de custo/i.test(w),
  );

  const rec = resultado.recursos;
  const catalogo = resultado.recursosCatalogo;

  // 7A — Alerta de divergência entre Nome do Projeto (arquivo) e CC selecionado.
  const projeto = resultado.projetoDetectado ?? null;
  const normalizar = (s: string | null | undefined) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();
  const projetoNomeNorm = normalizar(projeto?.nome ?? null);
  const ccCodigoNorm = normalizar(cc.codigo_centro_custo);
  const ccNomeNorm = normalizar(cc.nome_centro_custo);
  const projetoDivergeCc =
    !!projeto?.nome &&
    !!projetoNomeNorm &&
    !projetoNomeNorm.includes(ccCodigoNorm) &&
    !projetoNomeNorm.includes(ccNomeNorm);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ResumoItem label="Arquivo" value={resultado.nomeArquivo} />
        <ResumoItem
          label="Centro de Custo selecionado"
          value={`${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`}
        />
        <ResumoItem label="Linhas no arquivo" value={String(resultado.totalLinhas)} />
        <ResumoItem
          label="Período identificado"
          value={
            resultado.periodo.inicio && resultado.periodo.fim
              ? `${fmt(resultado.periodo.inicio)} → ${fmt(resultado.periodo.fim)}`
              : "—"
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">Atividades válidas: {resultado.resumo.validas}</Badge>
        <Badge variant="outline">Linhas ignoradas: {resultado.resumo.ignoradas}</Badge>
        {resultado.resumo.comErro > 0 && (
          <Badge variant="destructive">Com erro: {resultado.resumo.comErro}</Badge>
        )}
      </div>

      {resultado.resumo.ignoradas > 0 && (
        <p className="text-xs text-muted-foreground">
          Linhas ignoradas normalmente representam grupos, resumos, cabeçalhos
          internos ou linhas sem dados suficientes para virar atividade.
        </p>
      )}

      {/* Aviso obrigatório de fase */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Fase 6I.2-B — escopo de gravação</AlertTitle>
        <AlertDescription>
          Nesta fase só <strong>MOD/MOI</strong> são gravados como recursos
          operacionais. Equipamentos, materiais, sub-empreiteiros, administrativo
          e linhas de FATURAMENTO aparecem apenas no diagnóstico e não são
          enviados ao banco.
        </AlertDescription>
      </Alert>

      {/* Erros globais */}
      {resultado.globalErrors.length > 0 && (
        <Alert variant="destructive">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Importação bloqueada</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ml-5 space-y-1">
              {resultado.globalErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {ccAusente && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Centro de Custo não informado no arquivo</AlertTitle>
          <AlertDescription>
            O arquivo não informa Centro de Custo. Todas as atividades válidas
            serão vinculadas ao Centro de Custo selecionado:{" "}
            <strong>
              {cc.codigo_centro_custo} - {cc.nome_centro_custo}
            </strong>
            .
          </AlertDescription>
        </Alert>
      )}

      {projeto && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Projeto detectado no arquivo</AlertTitle>
          <AlertDescription>
            <div className="text-xs space-y-0.5">
              {projeto.nome && <div><strong>Nome:</strong> {projeto.nome}</div>}
              {projeto.autor && <div><strong>Autor:</strong> {projeto.autor}</div>}
              {(projeto.dataInicioProjeto || projeto.dataFimProjeto) && (
                <div>
                  <strong>Período:</strong>{" "}
                  {fmt(projeto.dataInicioProjeto)} → {fmt(projeto.dataFimProjeto)}
                </div>
              )}
              <div className="text-muted-foreground">
                O Centro de Custo selecionado é o dono oficial da importação. O nome
                acima é apenas descritivo.
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {projetoDivergeCc && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Possível divergência entre projeto e Centro de Custo</AlertTitle>
          <AlertDescription>
            O nome do projeto no arquivo (<strong>{projeto?.nome}</strong>) não
            menciona o código nem o nome do CC selecionado
            (<strong>{cc.codigo_centro_custo} - {cc.nome_centro_custo}</strong>).
            Confirme se o arquivo pertence mesmo a este CC antes de continuar.
            A importação não está bloqueada.
          </AlertDescription>
        </Alert>
      )}

      {resultado.avisos && resultado.avisos.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Avisos do parser ({resultado.avisos.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ml-5 space-y-0.5 text-xs max-h-40 overflow-auto">
              {resultado.avisos.slice(0, 30).map((a, i) => (
                <li key={i}>
                  <span className="font-mono">{a.codigo}</span> — {a.mensagem}
                </li>
              ))}
              {resultado.avisos.length > 30 && (
                <li className="text-muted-foreground">
                  …+{resultado.avisos.length - 30} avisos
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {outrosWarnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Avisos</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ml-5 space-y-1">
              {outrosWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Rascunho será criado</AlertTitle>
        <AlertDescription>
          A importação cria uma nova versão deste Centro de Custo como{" "}
          <strong>rascunho</strong>. O planejamento vigente atual permanece
          inalterado até que um SuperAdm revise e torne esta versão vigente.
        </AlertDescription>
      </Alert>

      {/* Botão exportar diagnóstico (acessível mesmo sem recursos) */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => exportarDiagnosticoImportacao(resultado, cc)}
        >
          <Download className="h-4 w-4" />
          Exportar diagnóstico (XLSX)
        </Button>
      </div>

      {/* ---------- Catálogo de Recursos ---------- */}
      {catalogo.length > 0 && (
        <div className="rounded-md border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">
              Catálogo de Recursos detectado ({catalogo.length})
            </h4>
          </div>
          {rec && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              {Object.entries(rec.catalogo.porGrupo).map(([g, n]) => (
                <ResumoNumero key={`g-${g}`} label={`Grupo ${g}`} value={n} />
              ))}
              {Object.entries(rec.catalogo.porFamilia).map(([f, n]) => (
                <ResumoNumero key={`f-${f}`} label={`Família ${f}`} value={n} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- INSUMOS — MOD/MOI ---------- */}
      {rec && (
        <div className="rounded-md border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">
              INSUMOS — Mão de Obra MOD/MOI (operacional, será gravado)
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <ResumoNumero label="MOD/MOI detectados" value={rec.detectadasMaoObra} />
            <ResumoNumero label="Mapeados" value={rec.mapeados} tone="success" />
            <ResumoNumero label="Sem função" value={rec.semFuncao} tone={rec.semFuncao > 0 ? "warning" : undefined} />
            <ResumoNumero label="Sem atividade" value={rec.semAtividade} tone={rec.semAtividade > 0 ? "warning" : undefined} />
            <ResumoNumero label="Ambíguos" value={rec.ambiguos} tone={rec.ambiguos > 0 ? "warning" : undefined} />
            <ResumoNumero
              label="Fora de escopo"
              value={rec.ignoradasPorFamilia}
              hint={
                Object.keys(rec.ignoradasPorFamiliaDetalhe).length > 0
                  ? Object.entries(rec.ignoradasPorFamiliaDetalhe).map(([k, v]) => `${k}: ${v}`).join(" · ")
                  : undefined
              }
            />
          </div>

          {(rec.funcoesNaoMapeadas.length > 0 || rec.alocacoesSemAtividade.length > 0) && (
            <Accordion type="multiple" className="text-sm">
              {rec.funcoesNaoMapeadas.length > 0 && (
                <AccordionItem value="funcoes">
                  <AccordionTrigger className="text-xs">
                    Funções não encontradas em bd_funcoes ({rec.funcoesNaoMapeadas.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-xs space-y-0.5 max-h-40 overflow-auto">
                      {rec.funcoesNaoMapeadas.map((f, i) => (
                        <li key={i} className="flex justify-between gap-2 border-b py-1">
                          <span className="truncate">{f.nomeRecurso}</span>
                          <Badge variant="outline" className="text-[10px]">{f.ocorrencias}x</Badge>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}
              {rec.alocacoesSemAtividade.length > 0 && (
                <AccordionItem value="atividades">
                  <AccordionTrigger className="text-xs">
                    Alocações sem atividade ({rec.alocacoesSemAtividade.length})
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-xs space-y-0.5 max-h-40 overflow-auto">
                      {rec.alocacoesSemAtividade.slice(0, 50).map((a, i) => (
                        <li key={i} className="border-b py-1">
                          <span className="font-medium">{a.nomeRecurso ?? "—"}</span>
                          <span className="text-muted-foreground">
                            {" → "}Tarefa: {a.nomeTarefa ?? "—"}
                            {a.uidTarefa ? ` (UID ${a.uidTarefa})` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          )}
        </div>
      )}

      {/* ---------- INSUMOS — EQ/MAT/SUB/ADM (diagnóstico) ---------- */}
      {rec && rec.diagnosticoNaoPersistido.total > 0 && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-700" />
              <h4 className="text-sm font-semibold">
                INSUMOS — EQ / MAT / SUB / ADM
              </h4>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Diagnóstico — não persistido nesta fase
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <ResumoNumero label="Atribuições" value={rec.diagnosticoNaoPersistido.total} />
            <ResumoNumero label="Horas" value={Math.round(rec.diagnosticoNaoPersistido.horas)} />
            {Object.entries(rec.diagnosticoNaoPersistido.porFamilia).map(([f, n]) => (
              <ResumoNumero key={`d-${f}`} label={f} value={n} />
            ))}
          </div>
        </div>
      )}

      {/* ---------- FATURAMENTO ---------- */}
      {rec && (rec.faturamento.atribuicoes > 0 || rec.faturamento.recursosCatalogo > 0) && (
        <Accordion type="single" collapsible className="rounded-md border bg-card">
          <AccordionItem value="fat" className="border-0">
            <AccordionTrigger className="px-4 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">FATURAMENTO</span>
                <Badge variant="outline" className="text-[10px]">Referência</Badge>
                <span className="text-xs text-muted-foreground">
                  {rec.faturamento.recursosCatalogo} recursos · {rec.faturamento.atribuicoes} atribuições · {Math.round(rec.faturamento.horas)}h
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <p className="text-xs text-muted-foreground">
                Itens marcados como grupo FATURAMENTO no catálogo. Aparecem apenas
                como referência e <strong>nunca</strong> são enviados ao banco
                nem entram nos totais operacionais.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* ---------- Inconsistências detectadas ---------- */}
      {rec && (rec.divergenciasFamilia.length > 0 || rec.suspeitasClassificacao.length > 0) && (
        <div className="rounded-md border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-700" />
            <h4 className="text-sm font-semibold">Inconsistências detectadas</h4>
          </div>
          <Accordion type="multiple" className="text-sm">
            {rec.divergenciasFamilia.length > 0 && (
              <AccordionItem value="divs">
                <AccordionTrigger className="text-xs">
                  Divergências família catálogo × atribuição ({rec.divergenciasFamilia.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="text-xs space-y-0.5 max-h-40 overflow-auto">
                    {rec.divergenciasFamilia.slice(0, 50).map((d, i) => (
                      <li key={i} className="border-b py-1">
                        <span className="font-medium">{d.nomeRecurso}</span>{" "}
                        <span className="text-muted-foreground">
                          declarada {d.declarada} · catálogo {d.efetiva}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
            {rec.suspeitasClassificacao.length > 0 && (
              <AccordionItem value="sus">
                <AccordionTrigger className="text-xs">
                  Suspeitas de classificação ({rec.suspeitasClassificacao.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="text-xs space-y-0.5 max-h-40 overflow-auto">
                    {rec.suspeitasClassificacao.slice(0, 50).map((s, i) => (
                      <li key={i} className="border-b py-1">
                        <span className="font-medium">{s.nomeRecurso}</span>{" "}
                        <span className="text-muted-foreground">
                          informada {s.familiaInformada} → sugerida {s.familiaSugerida} ({s.motivo})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Suspeitas são apenas alertas — nenhum dado é alterado automaticamente.
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>
      )}

      {/* Tabela de pré-visualização */}
      {resultado.atividades.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 z-10">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[260px]">Nome</TableHead>
                  <TableHead className="w-28">Início</TableHead>
                  <TableHead className="w-28">Fim</TableHead>
                  <TableHead className="w-24">Frente</TableHead>
                  <TableHead className="w-32">Qtde</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((a) => (
                  <TableRow
                    key={a.linhaOriginal}
                    className={cn(
                      a.errors.length > 0 && "bg-destructive/10",
                      a.ignored && "opacity-60"
                    )}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {a.linhaOriginal}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{a.nome || "—"}</div>
                      {(a.errors.length > 0 || a.warnings.length > 0) && (
                        <div className="text-xs mt-1 space-y-0.5">
                          {a.errors.map((e, i) => (
                            <div key={`e${i}`} className="text-destructive">• {e}</div>
                          ))}
                          {a.warnings.map((w, i) => (
                            <div key={`w${i}`} className="text-muted-foreground">• {w}</div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(a.data_inicio)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmt(a.data_fim)}</TableCell>
                    <TableCell className="text-xs">{a.frente_servico ?? "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {a.quantidade_prevista !== null
                        ? `${a.quantidade_prevista}${a.unidade ? ` ${a.unidade}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {a.ignored ? (
                        <Badge variant="outline">Ignorada</Badge>
                      ) : a.errors.length > 0 ? (
                        <Badge variant="destructive">Erro</Badge>
                      ) : (
                        <Badge variant="secondary">Válida</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {resultado.atividades.length > 20 && (
            <div className="p-2 border-t bg-muted/30 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMostrarTodas((v) => !v)}
                className="gap-1"
              >
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", mostrarTodas && "rotate-180")}
                />
                {mostrarTodas
                  ? "Mostrar apenas as 20 primeiras"
                  : `Ver todas (${resultado.atividades.length})`}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-2 pt-2 sticky bottom-0 bg-background">
        <Button variant="ghost" onClick={onTrocarArquivo} disabled={submitting}>
          Trocar arquivo
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={!podeConfirmar || submitting}>
            {submitting ? "Importando…" : "Confirmar importação"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const ResumoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="space-y-0.5">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm font-medium truncate" title={value}>
      {value}
    </div>
  </div>
);

const ResumoNumero: React.FC<{
  label: string;
  value: number;
  tone?: "success" | "warning";
  hint?: string;
}> = ({ label, value, tone, hint }) => (
  <div
    className={cn(
      "rounded border px-2 py-1.5",
      tone === "success" && "border-primary/40 bg-primary/5",
      tone === "warning" && "border-yellow-500/40 bg-yellow-500/5"
    )}
    title={hint}
  >
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="text-base font-semibold">{value}</div>
    {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
  </div>
);

export default PreviewStep;
