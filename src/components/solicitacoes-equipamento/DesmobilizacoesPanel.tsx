import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { DESMOBILIZACAO_INVALIDATE_KEYS } from "./desmobilizacaoQueryKeys";
import {
  DESMOBILIZACAO_STATUS_LABELS,
  cancelarDesmobilizacao,
  concluirDesmobilizacao,
  decidirDesmobilizacao,
  fetchDesmobilizacoes,
  type DesmobilizacaoStatus,
  type SolicitacaoDesmobilizacao,
} from "@/services/desmobilizacaoService";

const statusVariant = (s: DesmobilizacaoStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (s) {
    case "PENDENTE_APROVACAO":
      return "outline";
    case "APROVADA":
      return "default";
    case "REPROVADA":
      return "destructive";
    default:
      return "secondary";
  }
};

const DesmobilizacoesPanel: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const podeDecidir = isSuperAdmin || hasActionPermission("equipamentos_solicitacoes_aprovar", "aprovar");

  const [decisao, setDecisao] = useState<{ item: SolicitacaoDesmobilizacao; tipo: "APROVAR" | "REPROVAR" } | null>(null);
  const [cancelamento, setCancelamento] = useState<SolicitacaoDesmobilizacao | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["desmobilizacoes"],
    queryFn: fetchDesmobilizacoes,
  });

  const invalidar = () =>
    DESMOBILIZACAO_INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const decidirMutation = useMutation({
    mutationFn: () => decidirDesmobilizacao(decisao!.item.id, decisao!.tipo, motivo),
    onSuccess: (res) => {
      invalidar();
      toast({
        title: `Desmobilização ${DESMOBILIZACAO_STATUS_LABELS[res.status]}`,
        description:
          res.status === "APROVADA"
            ? "Previsão de liberação aplicada ao ativo, mantendo status Alocado e o centro de custo atual."
            : "A disponibilidade do ativo não foi alterada.",
      });
      setDecisao(null);
      setMotivo("");
    },
    onError: (e: Error) => toast({ title: "Não foi possível decidir", description: e.message, variant: "destructive" }),
  });

  const cancelarMutation = useMutation({
    mutationFn: () => cancelarDesmobilizacao(cancelamento!.id, motivo),
    onSuccess: (res) => {
      invalidar();
      toast({
        title: "Desmobilização cancelada",
        description: res.previsao_revertida
          ? "Previsão de liberação anterior restaurada."
          : res.divergencia_concorrente
          ? "A previsão atual foi definida por outro fluxo e foi preservada."
          : "Nenhuma previsão precisava ser revertida.",
      });
      setCancelamento(null);
      setMotivo("");
    },
    onError: (e: Error) => toast({ title: "Não foi possível cancelar", description: e.message, variant: "destructive" }),
  });

  const concluirMutation = useMutation({
    mutationFn: (id: string) => concluirDesmobilizacao(id),
    onSuccess: () => {
      invalidar();
      toast({ title: "Desmobilização concluída", description: "O ciclo do ativo foi encerrado." });
    },
    onError: (e: Error) => toast({ title: "Não foi possível concluir", description: e.message, variant: "destructive" }),
  });

  const pendentes = useMemo(() => itens.filter((i) => i.status === "PENDENTE_APROVACAO").length, [itens]);

  if (!isLoading && itens.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Desmobilizações de Veic/Equip
          {pendentes > 0 && <Badge variant="outline">{pendentes} pendente(s)</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ativo</TableHead>
              <TableHead>CC de origem</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Eng. responsável</TableHead>
              <TableHead>Eng. solicitante</TableHead>
              <TableHead>Retirada pretendida</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-sm">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {itens.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.equipamento_label}</TableCell>
                <TableCell className="text-sm">{i.centro_custo_origem_label}</TableCell>
                <TableCell className="text-sm">{i.solicitante_nome}</TableCell>
                <TableCell className="text-sm">{i.engenheiro_responsavel_nome}</TableCell>
                <TableCell className="text-sm">{i.engenheiro_solicitante_nome}</TableCell>
                <TableCell className="text-sm">
                  {formatBrazilianDateForDisplay(i.data_retirada)}
                  {i.hora_retirada ? ` ${i.hora_retirada.slice(0, 5)}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={statusVariant(i.status)}>{DESMOBILIZACAO_STATUS_LABELS[i.status]}</Badge>
                    {i.status === "REPROVADA" && i.motivo_recusa && (
                      <span className="text-xs text-muted-foreground">{i.motivo_recusa}</span>
                    )}
                    {i.status === "CANCELADA" && i.motivo_cancelamento && (
                      <span className="text-xs text-muted-foreground">{i.motivo_cancelamento}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  {i.status === "PENDENTE_APROVACAO" && podeDecidir && (
                    <>
                      <Button size="sm" onClick={() => { setMotivo(""); setDecisao({ item: i, tipo: "APROVAR" }); }}>
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setMotivo(""); setDecisao({ item: i, tipo: "REPROVAR" }); }}
                      >
                        Reprovar
                      </Button>
                    </>
                  )}
                  {(i.status === "PENDENTE_APROVACAO" || i.status === "APROVADA") && (
                    <Button size="sm" variant="outline" onClick={() => { setMotivo(""); setCancelamento(i); }}>
                      Cancelar
                    </Button>
                  )}
                  {i.status === "APROVADA" && i.saiu_do_cc_origem && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={concluirMutation.isPending}
                      onClick={() => concluirMutation.mutate(i.id)}
                    >
                      Concluir desmobilização
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!decisao} onOpenChange={(o) => { if (!o) { setDecisao(null); setMotivo(""); } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{decisao?.tipo === "APROVAR" ? "Aprovar" : "Reprovar"} desmobilização</DialogTitle>
            <DialogDescription>
              {decisao?.tipo === "APROVAR"
                ? "A data pretendida passará a ser a previsão de liberação do ativo. O ativo continua Alocado e mantém o centro de custo atual."
                : "A disponibilidade do ativo permanecerá inalterada."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{decisao?.tipo === "APROVAR" ? "Comentário (opcional)" : "Motivo da reprovação"}</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisao(null)} disabled={decidirMutation.isPending}>
              Voltar
            </Button>
            <Button
              variant={decisao?.tipo === "REPROVAR" ? "destructive" : "default"}
              onClick={() => decidirMutation.mutate()}
              disabled={decidirMutation.isPending}
            >
              {decidirMutation.isPending ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelamento} onOpenChange={(o) => { if (!o) { setCancelamento(null); setMotivo(""); } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Cancelar desmobilização</DialogTitle>
            <DialogDescription>
              A previsão de liberação anterior será restaurada se ainda estiver vigente. O centro de custo do ativo não
              é alterado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Motivo do cancelamento</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelamento(null)} disabled={cancelarMutation.isPending}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelarMutation.mutate()}
              disabled={cancelarMutation.isPending}
            >
              {cancelarMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DesmobilizacoesPanel;
