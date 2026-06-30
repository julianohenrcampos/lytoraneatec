import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Search, Loader2, User, Plus, Trash2, FileDown, AlertTriangle, RefreshCw, Save, Send, Ban,
} from 'lucide-react';
import { useFuncionarioSearch } from '@/hooks/ssoAgendamentoExames/useFuncionarioSearch';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { fmtBRLInput, parseBRL } from '@/utils/pdf/brlMask';
import {
  gerarPdfLoteSolicitacaoDesligamento,
  ItemLoteDesligamento,
} from '@/utils/pdf/gerarPdfLoteSolicitacaoDesligamento';
import * as svc from '@/services/rh/solicitacaoDesligamentoService';
import { useSolicitacaoDesligamento } from '@/hooks/rh/useSolicitacoesDesligamento';
import { usePermission } from '@/hooks/usePermission';
import type { DesligamentoItemInput } from '@/types/solicitacaoRh';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando definido, carrega solicitação existente (edit/view conforme status). */
  solicitacaoId?: string | null;
}

interface ItemEstado extends ItemLoteDesligamento {
  /** ID persistido (quando vindo do banco) — usado apenas para chave React. */
  _persistedId?: string;
}

const statusBadge: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
  emitida: { label: 'Emitida', cls: 'bg-primary/15 text-primary border-primary/30' },
  cancelada: { label: 'Cancelada', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export const SolicitacaoDesligamentoLoteDialog: React.FC<Props> = ({
  open, onOpenChange, solicitacaoId,
}) => {
  const { perfil } = useProfile();
  const { userId, isSuperAdmin } = usePermission();
  const scopeUserId: string | null = isSuperAdmin ? null : (userId ?? null);
  const qc = useQueryClient();
  const { data: existente, isLoading: loadingExistente } = useSolicitacaoDesligamento(open ? solicitacaoId ?? null : null);

  const {
    funcionarios, isLoading: loadingFunc, error: errorFunc, refetch,
    searchTerm, setSearchTerm, hasSearchTerm, resultLimit,
  } = useFuncionarioSearch(undefined, open);

  const [solId, setSolId] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string>('');
  const [status, setStatus] = useState<'rascunho' | 'emitida' | 'cancelada'>('rascunho');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemEstado[]>([]);
  const [salarioStr, setSalarioStr] = useState<Record<string, string>>({});
  const [rescisaoStr, setRescisaoStr] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ItemEstado | null>(null);
  const [removing, setRemoving] = useState(false);

  const readOnly = status !== 'rascunho';

  // Carrega estado existente quando o dialog abre com solicitacaoId
  useEffect(() => {
    if (!open) return;
    if (!solicitacaoId) {
      setSolId(null);
      setProtocolo('');
      setStatus('rascunho');
      setObservacoes('');
      setItens([]);
      setSalarioStr({});
      setRescisaoStr({});
      return;
    }
    if (!existente) return;
    setSolId(existente.header.id);
    setProtocolo(existente.header.protocolo);
    setStatus(existente.header.status);
    setObservacoes(existente.header.observacoes || '');
    const ss: Record<string, string> = {};
    const rs: Record<string, string> = {};
    const mapped: ItemEstado[] = existente.itens.map((it) => {
      const key = it.funcionario_id || it.id;
      if (it.salario_manual != null) ss[key] = fmtBRLInput(String(it.salario_manual * 100));
      if (it.valor_rescisao_manual != null) rs[key] = fmtBRLInput(String(it.valor_rescisao_manual * 100));
      return {
        _persistedId: it.id,
        funcionario_id: it.funcionario_id || it.id,
        nome: it.nome_snapshot,
        matricula: it.matricula_snapshot,
        cargo: it.cargo_snapshot || '—',
        centro_custo: it.centro_custo_snapshot || '—',
        centro_custo_id: it.centro_custo_id,
        cpf: it.cpf_snapshot || '',
        data_admissao: it.data_admissao_snapshot,
        salario_atual: it.salario_manual,
        valor_rescisao: it.valor_rescisao_manual,
        data_exame: it.data_exame,
        data_desligamento: it.data_desligamento,
      };
    });
    setItens(mapped);
    setSalarioStr(ss);
    setRescisaoStr(rs);
  }, [open, solicitacaoId, existente]);

  const adicionarFuncionario = async (funcId: string) => {
    if (readOnly) return;
    // NOTA DE ESCOPO: A lista de candidatos exibida vem de `useFuncionarioSearch`,
    // que já aplica `useEscopoCentrosCusto` (poda por allowedCentroIds — AdmOBRA
    // via adm_obra_funcionario_id, etc.). Esta query é apenas enriquecimento por
    // id de um item já selecionado dentro do escopo — não introduz vazamento.
    if (itens.find((i) => i.funcionario_id === funcId)) {
      toast.info('Funcionário já está na lista.');
      return;
    }
    setAdding(funcId);
    try {
      const { data, error } = await supabase
        .from('bd_funcionarios')
        .select(`
          id, nome_completo, matricula, cpf, data_admissao, centro_custo_id,
          bd_funcoes(nome_funcao),
          bd_centros_custo:centro_custo_id(codigo_centro_custo, nome_centro_custo)
        `)
        .eq('id', funcId)
        .single();
      if (error) throw error;
      const f: any = data;
      const cc = f.bd_centros_custo
        ? `${f.bd_centros_custo.codigo_centro_custo} - ${f.bd_centros_custo.nome_centro_custo}`
        : '—';
      setItens((prev) => [
        ...prev,
        {
          funcionario_id: f.id,
          nome: f.nome_completo,
          matricula: f.matricula,
          cargo: f.bd_funcoes?.nome_funcao || '—',
          centro_custo: cc,
          centro_custo_id: f.centro_custo_id,
          cpf: f.cpf,
          data_admissao: f.data_admissao,
          salario_atual: null,
          valor_rescisao: null,
          data_exame: null,
          data_desligamento: null,
        },
      ]);
    } catch (e: any) {
      toast.error('Erro ao adicionar funcionário: ' + e.message);
    } finally {
      setAdding(null);
    }
  };

  const removerItem = async (it: ItemEstado) => {
    if (readOnly) return;
    const funcId = it.funcionario_id;
    // Se persistido, remove do banco e recalcula totais do cabeçalho
    if (it._persistedId && solId) {
      setRemoving(true);
      try {
        await svc.removerItem(it._persistedId, scopeUserId);
        const restantes = itens.filter((x) => x._persistedId !== it._persistedId);
        setItens(restantes);
        setSalarioStr((prev) => { const c = { ...prev }; delete c[funcId]; return c; });
        setRescisaoStr((prev) => { const c = { ...prev }; delete c[funcId]; return c; });
        const totais = svc.calcularTotais(
          restantes.map((r) => ({
            funcionario_id: r.funcionario_id,
            nome_snapshot: r.nome,
            matricula_snapshot: r.matricula ?? null,
            cpf_snapshot: r.cpf || null,
            cargo_snapshot: r.cargo,
            centro_custo_id: r.centro_custo_id ?? null,
            centro_custo_snapshot: r.centro_custo,
            data_admissao_snapshot: r.data_admissao,
            salario_manual: r.salario_atual,
            valor_rescisao_manual: r.valor_rescisao,
            data_exame: r.data_exame,
            data_desligamento: r.data_desligamento,
          })),
        );
        await svc.atualizarRascunhoHeader(solId, totais, scopeUserId);
        qc.invalidateQueries({ queryKey: ['solicitacoes-desligamento'] });
        toast.success('Funcionário removido da solicitação.');
      } catch (e: any) {
        toast.error('Erro ao remover: ' + (e?.message ?? 'falha'));
      } finally {
        setRemoving(false);
        setRemoveTarget(null);
      }
      return;
    }
    // Item só em memória
    setItens((prev) => prev.filter((i) => i.funcionario_id !== funcId));
    setSalarioStr((prev) => { const c = { ...prev }; delete c[funcId]; return c; });
    setRescisaoStr((prev) => { const c = { ...prev }; delete c[funcId]; return c; });
    setRemoveTarget(null);
  };

  const atualizarItem = (funcId: string, patch: Partial<ItemEstado>) => {
    if (readOnly) return;
    setItens((prev) => prev.map((i) => (i.funcionario_id === funcId ? { ...i, ...patch } : i)));
  };

  const camposObrigatoriosOk = useMemo(
    () =>
      itens.length > 0 &&
      itens.every(
        (i) =>
          i.salario_atual != null &&
          i.valor_rescisao != null &&
          !!i.data_exame &&
          !!i.data_desligamento,
      ),
    [itens],
  );

  const itensParaPersistir = (): DesligamentoItemInput[] =>
    itens.map((it) => ({
      funcionario_id: it.funcionario_id,
      nome_snapshot: it.nome,
      matricula_snapshot: it.matricula ?? null,
      cpf_snapshot: it.cpf || null,
      cargo_snapshot: it.cargo,
      centro_custo_id: it.centro_custo_id ?? null,
      centro_custo_snapshot: it.centro_custo,
      data_admissao_snapshot: it.data_admissao,
      salario_manual: it.salario_atual,
      valor_rescisao_manual: it.valor_rescisao,
      data_exame: it.data_exame,
      data_desligamento: it.data_desligamento,
    }));

  /** Garante que existe um cabeçalho rascunho e devolve o id. */
  const garantirRascunho = async (): Promise<string> => {
    if (solId) return solId;
    const novo = await svc.criarRascunho({
      solicitante_id: perfil?.id ?? null,
      solicitante_nome_snapshot: perfil?.nome_completo ?? null,
      observacoes,
    });
    setSolId(novo.id);
    setProtocolo(novo.protocolo);
    setStatus(novo.status);
    return novo.id;
  };

  const salvarRascunho = async () => {
    setSaving(true);
    try {
      const id = await garantirRascunho();
      const persist = itensParaPersistir();
      await svc.substituirItens(id, persist, scopeUserId);
      const totais = svc.calcularTotais(persist);
      await svc.atualizarRascunhoHeader(id, { observacoes, ...totais }, scopeUserId);
      toast.success('Rascunho salvo.');
      qc.invalidateQueries({ queryKey: ['solicitacoes-desligamento'] });
    } catch (e: any) {
      toast.error('Erro ao salvar rascunho: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const emitir = async () => {
    if (!camposObrigatoriosOk) {
      toast.error('Preencha salário, rescisão, data de exame e data de desligamento de todos.');
      return;
    }
    setEmitting(true);
    try {
      const id = await garantirRascunho();
      const persist = itensParaPersistir();
      await svc.substituirItens(id, persist, scopeUserId);
      const totais = svc.calcularTotais(persist);
      await svc.atualizarRascunhoHeader(id, { observacoes, ...totais }, scopeUserId);
      await svc.emitirSolicitacao(id, perfil ?? null, persist.map((p) => p.centro_custo_id), scopeUserId);
      toast.success(`Solicitação ${protocolo} emitida.`);
      qc.invalidateQueries({ queryKey: ['solicitacoes-desligamento'] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao emitir: ' + e.message);
    } finally {
      setEmitting(false);
    }
  };

  /** Gera PDF a partir dos snapshots persistidos (ou estado atual, em rascunho). */
  const gerarPdf = async () => {
    setGeneratingPdf(true);
    try {
      let header = existente?.header;
      if (!header && solId) {
        const got = await svc.obterSolicitacao(solId, scopeUserId);
        header = got.header;
      }
      gerarPdfLoteSolicitacaoDesligamento({
        protocolo: protocolo || header?.protocolo || '—',
        data_emissao: header?.data_solicitacao ? new Date(header.data_solicitacao) : new Date(),
        solicitante: header?.solicitante_nome_snapshot || perfil?.nome_completo || '—',
        observacoes: observacoes || null,
        itens: itens.map(({ _persistedId, ...rest }) => rest),
        nome_gerente_area: header?.gerente_area_nome_snapshot ?? null,
        nome_diretor_area: header?.diretor_area_nome_snapshot ?? null,
        nome_diretoria_financeira: header?.diretoria_financeira_nome_snapshot ?? null,
      });
    } catch (e: any) {
      toast.error('Erro ao gerar PDF: ' + e.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const cancelar = async () => {
    if (!solId) return;
    setCanceling(true);
    try {
      await svc.cancelarSolicitacao(solId, scopeUserId);
      toast.success('Solicitação cancelada.');
      qc.invalidateQueries({ queryKey: ['solicitacoes-desligamento'] });
      setConfirmCancelOpen(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao cancelar: ' + (e?.message ?? 'falha'));
    } finally {
      setCanceling(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setItens([]); setSalarioStr({}); setRescisaoStr({});
      setObservacoes(''); setSearchTerm('');
      setSolId(null); setProtocolo(''); setStatus('rascunho');
    }
    onOpenChange(next);
  };

  const renderBusca = () => {
    if (loadingFunc) return (
      <div className="flex items-center justify-center h-32 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    );
    if (errorFunc) return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <AlertTriangle className="h-7 w-7 text-destructive" />
        <p className="text-sm text-destructive">Erro ao buscar</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3 mr-1" />Tentar
        </Button>
      </div>
    );
    if (funcionarios.length === 0) return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4 text-center">
        <User className="h-7 w-7 mb-2" />
        <p className="text-sm">{hasSearchTerm ? 'Nenhum encontrado' : 'Digite nome ou CPF'}</p>
      </div>
    );
    return (
      <div className="p-2 space-y-1">
        {funcionarios.length >= resultLimit && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            Mostrando os primeiros {resultLimit}. Refine a busca.
          </p>
        )}
        {funcionarios.map((f) => {
          const already = !!itens.find((i) => i.funcionario_id === f.id);
          return (
            <div key={f.id} className="p-2 rounded-md border bg-background flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{f.nome_completo}</p>
                <p className="text-xs text-muted-foreground truncate">{f.funcao || 'Sem função'} · CPF: {f.cpf}</p>
              </div>
              <Button size="sm" variant={already ? 'secondary' : 'default'}
                disabled={already || adding === f.id}
                onClick={() => adicionarFuncionario(f.id)}>
                {adding === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> :
                  already ? 'Adicionado' : <><Plus className="h-3 w-3 mr-1" />Adicionar</>}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  const titulo = solicitacaoId
    ? (readOnly ? 'Visualizar Solicitação de Desligamento' : 'Editar Solicitação de Desligamento')
    : 'Nova Solicitação de Desligamento';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-3">
              {titulo}
              {protocolo && (
                <Badge variant="outline" className={statusBadge[status].cls}>
                  {statusBadge[status].label}
                </Badge>
              )}
            </span>
          </DialogTitle>
        </DialogHeader>

        {loadingExistente && solicitacaoId ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className={`grid gap-4 ${readOnly ? '' : 'lg:grid-cols-[340px_1fr]'}`}>
            {!readOnly && (
              <div className="space-y-2">
                <Label>Buscar funcionários</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nome ou CPF..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <ScrollArea className="h-[420px] border rounded-md">{renderBusca()}</ScrollArea>
                <p className="text-xs text-muted-foreground">
                  1 funcionário = solicitação individual. Vários = lote.
                  Salvar Rascunho preserva o trabalho; Emitir congela o documento.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Funcionários na solicitação ({itens.length})</Label>
              </div>

              {itens.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground text-sm border-dashed">
                  {readOnly ? 'Sem itens.' : 'Adicione funcionários da busca à esquerda.'}
                </Card>
              ) : (
                <ScrollArea className="h-[420px] pr-2">
                  <div className="space-y-2">
                    {itens.map((it) => (
                      <Card key={it._persistedId || it.funcionario_id} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{it.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {it.cargo} · {it.centro_custo} · Mat: {it.matricula || '—'} · CPF: {it.cpf}
                            </p>
                          </div>
                          {!readOnly && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                              onClick={() => setRemoveTarget(it)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Salário atual *</Label>
                            <Input
                              inputMode="numeric"
                              placeholder="R$ 0,00"
                              disabled={readOnly}
                              value={salarioStr[it.funcionario_id] || ''}
                              onChange={(e) => {
                                const formatted = fmtBRLInput(e.target.value);
                                setSalarioStr((prev) => ({ ...prev, [it.funcionario_id]: formatted }));
                                atualizarItem(it.funcionario_id, { salario_atual: parseBRL(formatted) });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Valor rescisão *</Label>
                            <Input
                              inputMode="numeric"
                              placeholder="R$ 0,00"
                              disabled={readOnly}
                              value={rescisaoStr[it.funcionario_id] || ''}
                              onChange={(e) => {
                                const formatted = fmtBRLInput(e.target.value);
                                setRescisaoStr((prev) => ({ ...prev, [it.funcionario_id]: formatted }));
                                atualizarItem(it.funcionario_id, { valor_rescisao: parseBRL(formatted) });
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Data exame *</Label>
                            <Input type="date" disabled={readOnly} value={it.data_exame || ''}
                              onChange={(e) => atualizarItem(it.funcionario_id, { data_exame: e.target.value || null })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Data desligamento *</Label>
                            <Input type="date" disabled={readOnly} value={it.data_desligamento || ''}
                              onChange={(e) => atualizarItem(it.funcionario_id, { data_desligamento: e.target.value || null })} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Observações gerais da solicitação</Label>
                <Textarea rows={2} value={observacoes} disabled={readOnly}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Opcional..." />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => handleClose(false)}>Fechar</Button>
          {status === 'emitida' && (
            <Button variant="destructive" onClick={() => setConfirmCancelOpen(true)}>
              <Ban className="h-4 w-4 mr-2" /> Cancelar Solicitação
            </Button>
          )}
          <Button variant="secondary" onClick={gerarPdf} disabled={generatingPdf || itens.length === 0}>
            {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
            Gerar PDF
          </Button>
          {!readOnly && (
            <>
              <Button variant="outline" onClick={salvarRascunho} disabled={saving || itens.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Rascunho
              </Button>
              <Button onClick={emitir} disabled={!camposObrigatoriosOk || emitting}>
                {emitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Emitir Solicitação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmCancelOpen} onOpenChange={(o) => !canceling && setConfirmCancelOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar a solicitação e ela não poderá mais ser editada.
              Os dados permanecerão disponíveis apenas para consulta e reimpressão do PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); cancelar(); }}
            >
              {canceling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !removing && !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário da solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.nome
                ? <><strong>{removeTarget.nome}</strong> será removido apenas desta solicitação. O cadastro do funcionário não será alterado.</>
                : 'Este funcionário será removido apenas desta solicitação. O cadastro do funcionário não será alterado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (removeTarget) removerItem(removeTarget); }}
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover Funcionário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
