import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Clock, ShoppingCart, XCircle } from "lucide-react";
import { SolicitacaoTransporte, fetchAnaliseOperacional, AnaliseOperacional, DecisaoTransporte, DECISAO_LABELS } from "@/services/centralTransporteService";
import DecisaoTransporteDialog from "./DecisaoTransporteDialog";
import CriarMovimentacaoModal from "./CriarMovimentacaoModal";
import { formatDateBR } from "@/utils/formatDateBR";

interface Props {
  solicitacao: SolicitacaoTransporte | null;
  open: boolean;
  onClose: () => void;
  onDecisaoSaved: () => void;
}

const AnaliseOperacionalSheet: React.FC<Props> = ({ solicitacao, open, onClose, onDecisaoSaved }) => {
  const [analise, setAnalise] = useState<AnaliseOperacional | null>(null);
  const [loading, setLoading] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [decisaoDialog, setDecisaoDialog] = useState<DecisaoTransporte | null>(null);
  const [showMovimentacao, setShowMovimentacao] = useState(false);
  const [planejamentoId, setPlanejamentoId] = useState<string | undefined>();
  const [tipoAtendimentoMov, setTipoAtendimentoMov] = useState("");

  useEffect(() => {
    if (!solicitacao || !open) return;
    setLoading(true);
    setObservacao("");
    fetchAnaliseOperacional(solicitacao.tipo_equipamento_id)
      .then(setAnalise)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [solicitacao, open]);

  if (!solicitacao) return null;

  const isAprovado = solicitacao.status_fluxo === "APROVADO";

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Análise Operacional — {solicitacao.id.slice(0, 8)}</SheetTitle>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Tipo:</strong> {solicitacao.descricao_tipo_equipamento || "—"} | <strong>Qtd:</strong> {solicitacao.quantidade} | <strong>Prioridade:</strong> {solicitacao.prioridade}</p>
              <p><strong>CC:</strong> {solicitacao.nome_centro_custo} | <strong>Dept:</strong> {solicitacao.departamento_nome || "—"}</p>
            </div>
          </SheetHeader>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
          ) : analise ? (
            <div className="mt-4 space-y-4">
              <Tabs defaultValue="propria">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="propria" className="text-xs">Própria ({analise.disponibilidadePropria.length})</TabsTrigger>
                  <TabsTrigger value="grupo" className="text-xs">Grupo ({analise.disponibilidadeGrupo.length})</TabsTrigger>
                  <TabsTrigger value="previsao" className="text-xs">Previsão ({analise.equipamentosComPrevisao.length})</TabsTrigger>
                  <TabsTrigger value="portfolio" className="text-xs">Externo ({analise.portfolioExterno.length})</TabsTrigger>
                  <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
                </TabsList>

                <TabsContent value="propria">
                  <MiniTable
                    headers={["Frota", "Nº Frota", "Empresa", "CC", "Status"]}
                    rows={analise.disponibilidadePropria.map((d) => [d.frota, d.numero_frota, d.empresa, d.centro_custo, d.status])}
                    emptyMsg="Nenhum equipamento próprio disponível."
                  />
                </TabsContent>

                <TabsContent value="grupo">
                  <MiniTable
                    headers={["Frota", "Nº Frota", "Empresa", "CC", "Status"]}
                    rows={analise.disponibilidadeGrupo.map((d) => [d.frota, d.numero_frota, d.empresa, d.centro_custo, d.status])}
                    emptyMsg="Nenhum equipamento do grupo disponível."
                  />
                </TabsContent>

                <TabsContent value="previsao">
                  <MiniTable
                    headers={["Frota", "Nº Frota", "CC", "Status", "Previsão", "Confiab."]}
                    rows={analise.equipamentosComPrevisao.map((d) => [
                      d.frota, d.numero_frota, d.centro_custo, d.status,
                      formatDateBR(d.previsao_liberacao),
                      d.confiabilidade || "—",
                    ])}
                    emptyMsg="Nenhum equipamento com previsão de liberação."
                  />
                </TabsContent>

                <TabsContent value="portfolio">
                  <MiniTable
                    headers={["Empresa", "Qtd Estimada", "C/ Operador", "S/ Operador"]}
                    rows={analise.portfolioExterno.map((p) => [
                      p.empresa,
                      p.quantidade_estimada,
                      p.valor_com_operador ? `R$ ${Number(p.valor_com_operador).toLocaleString("pt-BR")}` : "—",
                      p.valor_sem_operador ? `R$ ${Number(p.valor_sem_operador).toLocaleString("pt-BR")}` : "—",
                    ])}
                    emptyMsg="Nenhum fornecedor externo no portfólio."
                  />
                </TabsContent>

                <TabsContent value="resumo">
                  <div className="p-4 rounded-md bg-muted/50 text-sm">{analise.sugestao}</div>
                </TabsContent>
              </Tabs>

              {isAprovado && (
                <div className="space-y-3 border-t pt-4">
                  <Textarea
                    placeholder="Observações sobre a decisão..."
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setDecisaoDialog("INTERNO")} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Atender Interno
                    </Button>
                    <Button variant="secondary" onClick={() => setDecisaoDialog("RESERVA")} className="gap-2">
                      <Clock className="h-4 w-4" /> Reservar Futuro
                    </Button>
                    <Button variant="outline" onClick={() => setDecisaoDialog("COTACAO")} className="gap-2">
                      <ShoppingCart className="h-4 w-4" /> Cotação Externa
                    </Button>
                    <Button variant="destructive" onClick={() => setDecisaoDialog("INDISPONIVEL")} className="gap-2">
                      <XCircle className="h-4 w-4" /> Indisponível
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {decisaoDialog && (
        <DecisaoTransporteDialog
          open={!!decisaoDialog}
          decisao={decisaoDialog}
          solicitacaoId={solicitacao.id}
          observacao={observacao}
          onClose={() => setDecisaoDialog(null)}
          onSaved={() => {
            setDecisaoDialog(null);
            const tipo = decisaoDialog === "INTERNO" ? "INTERNO" : decisaoDialog === "COTACAO" ? "EXTERNO" : "";
            if (tipo) {
              setTipoAtendimentoMov(tipo);
              setShowMovimentacao(true);
            } else {
              onDecisaoSaved();
              onClose();
            }
          }}
        />
      )}

      {showMovimentacao && (
        <CriarMovimentacaoModal
          open={showMovimentacao}
          solicitacaoId={solicitacao.id}
          planejamentoId={planejamentoId}
          tipoAtendimento={tipoAtendimentoMov}
          tipoEquipamentoId={solicitacao.tipo_equipamento_id}
          onClose={() => {
            setShowMovimentacao(false);
            onDecisaoSaved();
            onClose();
          }}
          onSaved={() => {
            setShowMovimentacao(false);
            onDecisaoSaved();
            onClose();
          }}
        />
      )}
    </>
  );
};

const MiniTable: React.FC<{ headers: string[]; rows: any[][]; emptyMsg: string }> = ({ headers, rows, emptyMsg }) => (
  <div className="rounded-md border overflow-auto max-h-[300px]">
    <Table>
      <TableHeader>
        <TableRow>{headers.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={headers.length} className="text-center text-muted-foreground py-4 text-sm">{emptyMsg}</TableCell></TableRow>
        ) : (
          rows.map((row, i) => (
            <TableRow key={i}>{row.map((cell, j) => <TableCell key={j} className="text-xs">{cell ?? "—"}</TableCell>)}</TableRow>
          ))
        )}
      </TableBody>
    </Table>
  </div>
);

export default AnaliseOperacionalSheet;
