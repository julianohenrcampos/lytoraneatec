/**
 * Conteúdo interno do Relatório AP's (sem Dialog wrapper).
 * Recebe o retorno de `useRelatorioApsState` como prop e é reutilizado por:
 *  - `RelatorioApsBuilder` (Dialog, fluxo E1/E2 na tela Registro de Aplicação).
 *  - `RelatorioApsAba` (inline, fluxo E3.1 em /relatorio-aplicacao-diaria).
 */
import React, { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  MapPin,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
// formatBrazilianDateForDisplay removido: coluna Data agora usa <input type="date">.
import { RELATORIO_APS_MAX_FOTOS, type RelatorioApsLinha } from "@/types/relatorioAps";
import RelatorioApsMapa, { type RelatorioApsMapaHandle } from "./RelatorioApsMapa";
import RelatorioApsFotosDialog from "./RelatorioApsFotosDialog";
import { formatTonelada } from "@/lib/relatorio-aps/formatters";
import {
  agruparPorLogradouro,
  espessuraExibicaoM,
  type GrupoLinhas,
} from "@/lib/relatorio-aps/agrupar";
import type { UseRelatorioApsStateReturn } from "@/hooks/relatorio-aps/useRelatorioApsState";

const fmtNumber = (v: number | null | undefined, digits = 2): string => {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};
const padOrdem = (n: number): string => String(n).padStart(2, "0");

interface Props {
  ctrl: UseRelatorioApsStateReturn;
  mapaRef?: React.Ref<RelatorioApsMapaHandle>;
}

/** Classe compartilhada para colunas-operador (m x, m =, etc.) — largura por conteúdo. */
const OP_CELL =
  "w-px whitespace-nowrap px-1 text-center text-[11px] font-normal text-muted-foreground bg-muted/40 align-middle";

/** Input inline discreto (sem borda em repouso, underline sutil no foco). */
const INLINE_INPUT =
  "h-auto w-full min-w-0 border-0 border-b border-transparent bg-transparent p-0 text-center text-xs tabular-nums shadow-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";
const INLINE_INPUT_LEFT =
  "h-auto w-full min-w-0 border-0 border-b border-transparent bg-transparent p-0 text-left text-xs shadow-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

const RelatorioApsBuilderContent: React.FC<Props> = ({ ctrl, mapaRef }) => {
  const {
    state,
    setCampoCabecalho,
    setCampoLinha,
    selecionarFoto,
    removerFotoSelecionada,
    moverFotoSelecionada,
    setLegendaFoto,
    mapaAdicionarPonto,
    mapaDesfazerUltimoPonto,
    mapaLimparLinha,
    mapaIniciarArea,
    mapaAdicionarPontoArea,
    mapaDesfazerPontoArea,
    mapaFecharArea,
    mapaCancelarArea,
    mapaLimparAreas,
  } = ctrl;
  const { carregando, erro, cabecalho, linhas, fotosDisponiveis, fotosSelecionadas, mapa } = state;

  const [fotosDialogOpen, setFotosDialogOpen] = useState(false);
  const [notasFinais, setNotasFinais] = useState("");

  const grupos: GrupoLinhas[] = useMemo(() => agruparPorLogradouro(linhas), [linhas]);
  const totalGeralArea = useMemo(
    () => linhas.reduce((acc, l) => acc + (l.areaAplicada || 0), 0),
    [linhas],
  );
  const totalGeralT = useMemo(
    () => linhas.reduce((acc, l) => acc + (l.totalKg || 0) / 1000, 0),
    [linhas],
  );

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">


      {/* Espelho impresso — grid 12 col em lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LINHA 1 · Tabela (8/12) */}
        <Card className="lg:col-span-8 h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Registro de Aplicação por Trecho ({linhas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum apontamento carregado.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto lg:overflow-x-visible max-h-[520px] overflow-y-auto">
                <Table className="w-full [&_td]:border [&_th]:border border-border text-xs [&_td]:py-1 [&_td]:px-2 [&_th]:py-1 [&_th]:px-2">
                  <TableHeader className="sticky top-0 bg-muted/50 z-10">
                    <TableRow>
                      <TableHead className="text-center">
                        <div className="font-semibold">Logradouro</div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="font-semibold">Situação</div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="font-semibold">Data</div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="font-semibold">Trecho</div>
                      </TableHead>
                      <TableHead className="text-center">Extensão</TableHead>
                      <TableHead className={OP_CELL}>m x</TableHead>
                      <TableHead className="text-center">Largura</TableHead>
                      <TableHead className={OP_CELL}>m =</TableHead>
                      <TableHead className="text-center">Área</TableHead>
                      <TableHead className={OP_CELL}>m² x</TableHead>
                      <TableHead className="text-center">Espessura</TableHead>
                      <TableHead className={OP_CELL}>m x</TableHead>
                      <TableHead className="text-center">Peso específico</TableHead>
                      <TableHead className={OP_CELL}>t/m³ =</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className={OP_CELL}>t</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map((grupo) => (
                      <React.Fragment key={grupo.logradouro}>
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="bg-foreground text-background text-xs uppercase font-semibold tracking-wide truncate"
                          >
                            {grupo.logradouro} — {grupo.rotulo}
                          </TableCell>
                          <TableCell className="bg-foreground text-background text-center tabular-nums font-semibold text-xs">
                            {fmtNumber(grupo.somaArea)}
                          </TableCell>
                          <TableCell colSpan={5} className="bg-foreground text-background" />
                          <TableCell className="bg-foreground text-background text-center tabular-nums font-semibold text-xs">
                            {formatTonelada(grupo.somaTotalT)}
                          </TableCell>
                          <TableCell className="bg-foreground text-background text-center text-[11px]">
                            t
                          </TableCell>
                        </TableRow>
                        {grupo.linhas.map((l) => (
                          <TableRow key={l.id} className="even:bg-muted/20">
                            <TableCell className="text-left">
                              <Input
                                value={l.logradouro}
                                onChange={(e) => setCampoLinha(l.id, "logradouro", e.target.value)}
                                className={INLINE_INPUT_LEFT}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                value={l.situacao}
                                onChange={(e) => setCampoLinha(l.id, "situacao", e.target.value)}
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="date"
                                value={l.data || ""}
                                onChange={(e) => setCampoLinha(l.id, "data", e.target.value)}
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                value={l.trecho}
                                onChange={(e) => setCampoLinha(l.id, "trecho", e.target.value)}
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className="text-center tabular-nums">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.comprimento ?? ""}
                                onChange={(e) =>
                                  setCampoLinha(l.id, "comprimento", e.target.value === "" ? null : Number(e.target.value))
                                }
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className={OP_CELL}>m x</TableCell>
                            <TableCell className="text-center tabular-nums">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.larguraMedia ?? ""}
                                onChange={(e) =>
                                  setCampoLinha(l.id, "larguraMedia", e.target.value === "" ? null : Number(e.target.value))
                                }
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className={OP_CELL}>m =</TableCell>
                            <TableCell className="text-center tabular-nums">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.areaAplicada ?? 0}
                                onChange={(e) =>
                                  setCampoLinha(l.id, "areaAplicada", Number(e.target.value) || 0)
                                }
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className={OP_CELL}>m² x</TableCell>
                            <TableCell className="text-center tabular-nums">
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={espessuraExibicaoM(l).toFixed(3)}
                                onChange={(e) => {
                                  const m = Number(e.target.value);
                                  setCampoLinha(l.id, "espessura", Number.isFinite(m) ? m * 100 : null);
                                }}
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className={OP_CELL}>m x</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={l.pesoKgM2}
                                onChange={(e) =>
                                  setCampoLinha(l.id, "pesoKgM2", Number(e.target.value) || 0)
                                }
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className={OP_CELL}>t/m³ =</TableCell>
                            <TableCell className="text-center font-medium tabular-nums">
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={((l.totalKg || 0) / 1000).toFixed(3)}
                                onChange={(e) => {
                                  const t = Number(e.target.value);
                                  setCampoLinha(l.id, "totalKg", Number.isFinite(t) ? t * 1000 : 0);
                                }}
                                className={INLINE_INPUT}
                              />
                            </TableCell>
                            <TableCell className={OP_CELL}>t</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                    {/* Totais gerais */}
                    <TableRow className="bg-muted/60 font-semibold">
                      <TableCell colSpan={8} className="text-right uppercase text-xs">
                        Total geral
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {fmtNumber(totalGeralArea)}
                      </TableCell>
                      <TableCell colSpan={6} />
                      <TableCell className="text-center tabular-nums">
                        {formatTonelada(totalGeralT)}
                      </TableCell>
                      <TableCell className={OP_CELL}>t</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LINHA 1 · Fotos 2x3 (4/12) */}
        <Card className="lg:col-span-4 h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                Registro Fotográfico dos Serviços ({fotosSelecionadas.length}/
                {RELATORIO_APS_MAX_FOTOS})
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setFotosDialogOpen(true)}
                disabled={fotosDisponiveis.length === 0}
              >
                <ImageIcon className="h-3.5 w-3.5 mr-1" />
                Escolher imagens
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: RELATORIO_APS_MAX_FOTOS }).map((_, idx) => {
                const foto = fotosSelecionadas[idx];
                if (!foto) {
                  return (
                    <button
                      key={`slot-${idx}`}
                      type="button"
                      onClick={() => setFotosDialogOpen(true)}
                      disabled={fotosDisponiveis.length === 0}
                      className="border-2 border-dashed rounded-md p-4 flex flex-col items-center justify-center text-muted-foreground min-h-[140px] hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-6 w-6 mb-1 opacity-60" />
                      <span className="text-xs">Slot {padOrdem(idx + 1)}</span>
                    </button>
                  );
                }
                const isPrimeiro = idx === 0;
                const isUltimo = idx === fotosSelecionadas.length - 1;
                return (
                  <div key={foto.id} className="border rounded-md overflow-hidden bg-card">
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={foto.signedUrl}
                        alt={foto.legenda}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-semibold rounded px-1.5 py-0.5">
                        {padOrdem(foto.ordem)}
                      </span>
                    </div>
                    <div className="p-2 space-y-2">
                      <Input
                        value={foto.legenda}
                        onChange={(e) => setLegendaFoto(foto.id, e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Legenda"
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={isPrimeiro}
                          onClick={() => moverFotoSelecionada(foto.id, "cima")}
                          title="Mover para cima"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={isUltimo}
                          onClick={() => moverFotoSelecionada(foto.id, "baixo")}
                          title="Mover para baixo"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
                          onClick={() => removerFotoSelecionada(foto.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* LINHA 2 · Mapa (8/12) */}
        <Card className="lg:col-span-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Localização e Traçado dos Serviços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RelatorioApsMapa
              ref={mapaRef}
              pontosServico={mapa.pontosServico}
              linhaServico={mapa.linhaServico}
              areasAplicacao={mapa.areasAplicacao}
              areaEmEdicao={mapa.areaEmEdicao}
              onAdicionarPontoLinha={mapaAdicionarPonto}
              onDesfazerLinha={mapaDesfazerUltimoPonto}
              onLimparLinha={mapaLimparLinha}
              onIniciarArea={mapaIniciarArea}
              onAdicionarPontoArea={mapaAdicionarPontoArea}
              onDesfazerPontoArea={mapaDesfazerPontoArea}
              onFecharArea={mapaFecharArea}
              onCancelarArea={mapaCancelarArea}
              onLimparAreas={mapaLimparAreas}
            />
          </CardContent>
        </Card>

        {/* LINHA 2 · Coluna direita: Notas + Dados editáveis (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-primary" />
                Notas / Observações Finais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notasFinais}
                onChange={(e) => setNotasFinais(e.target.value)}
                placeholder="Notas finais do relatório (opcional)"
                rows={4}
                className="resize-none text-sm"
              />
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Dados do Relatório
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="rel-obra"
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Obra
                  </Label>
                  <Input
                    id="rel-obra"
                    value={cabecalho.obra}
                    onChange={(e) => setCampoCabecalho("obra", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="rel-empresa"
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Empresa
                    </Label>
                    <Input
                      id="rel-empresa"
                      value={cabecalho.empresa}
                      onChange={(e) => setCampoCabecalho("empresa", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="rel-cliente"
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Cliente
                    </Label>
                    <Input
                      id="rel-cliente"
                      value={cabecalho.cliente}
                      onChange={(e) => setCampoCabecalho("cliente", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="rel-rua"
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Rua
                  </Label>
                  <Input
                    id="rel-rua"
                    value={cabecalho.rua}
                    onChange={(e) => setCampoCabecalho("rua", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="rel-bairro"
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Bairro
                    </Label>
                    <Input
                      id="rel-bairro"
                      value={cabecalho.bairro}
                      onChange={(e) => setCampoCabecalho("bairro", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="rel-revisao"
                      className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Revisão
                    </Label>
                    <Input
                      id="rel-revisao"
                      value={cabecalho.revisao}
                      onChange={(e) => setCampoCabecalho("revisao", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="rel-obs"
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Observações
                  </Label>
                  <Textarea
                    id="rel-obs"
                    rows={3}
                    value={cabecalho.observacoes}
                    onChange={(e) => setCampoCabecalho("observacoes", e.target.value)}
                    placeholder="Observações do apontador (opcional)"
                    className="text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <RelatorioApsFotosDialog
        open={fotosDialogOpen}
        onOpenChange={setFotosDialogOpen}
        fotosDisponiveis={fotosDisponiveis}
        fotosSelecionadas={fotosSelecionadas}
        onSelecionar={selecionarFoto}
        onRemover={removerFotoSelecionada}
        max={RELATORIO_APS_MAX_FOTOS}
      />
    </div>
  );
};

export default RelatorioApsBuilderContent;
