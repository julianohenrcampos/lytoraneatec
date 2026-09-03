// Dialog de Solicitação de Classificação em Lote (Fase 2B.1).
//
// REGRA CENTRAL (mantida da Fase 2B v3):
//   - "Salvar rascunho" NUNCA grava itens. Apenas observações são persistidas.
//   - Itens só são gravados em "Emitir solicitação", em batch único, todos
//     já nascendo com solicitacao_lote_id.
//
// LIMITAÇÃO Fase 2B: salário não é persistido (apenas referência visual).
//
// Fase 2B.1: refatoração APENAS de UX para alinhar ao padrão visual do
// modal "Nova Solicitação de Transferência" (duas colunas: busca à
// esquerda, lista de itens em cards à direita). Nenhuma alteração de
// service/hook/types/banco/RLS/RPC/PDF/exames.

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  Search,
  User,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { gerarPdfSolicitacaoClassificacaoLote } from '@/utils/pdf/gerarPdfSolicitacaoClassificacaoLote';
import {
  buildLogoMapFromItens,
  loadLytoraneaDefaultLogo,
} from '@/utils/pdf/empresaLogoMapClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Combobox } from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import {
  useSolicitacaoClassificacaoLote,
  useCriarRascunhoClassificacaoLote,
  useAtualizarObservacoesRascunho,
  useEmitirSolicitacaoClassificacaoLote,
} from '@/hooks/rh/useSolicitacoesClassificacaoLote';
import type { ItemRascunhoEmMemoria } from '@/types/rh/solicitacoesClassificacaoLote';

const BASE_PERMISSION = 'gestao_rh_solicitacoes_classificacao_view';
const MOTIVOS = ['Promoção', 'Mudança de Setor', 'Reclassificação', 'Ajuste Salarial'];

interface Props {
  open: boolean;
  loteId: string | null;
  viewOnly: boolean;
  onOpenChange: (open: boolean) => void;
}

type FuncionarioEscopo = {
  id: string;
  nome_completo: string;
  centro_custo_id: string;
  funcao_id: string | null;
  cc_label: string;
  funcao_nome: string | null;
  empresa_id: string | null;
  empresa_nome: string | null;
  empresa_logo_url: string | null;
  data_admissao: string | null;
  salario_base: number | null;
};

type Funcao = { id: string; nome_funcao: string; salario_base: number | null };

const statusBadge: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
  emitida: { label: 'Emitida', cls: 'bg-primary/15 text-primary border-primary/30' },
  cancelada: { label: 'Cancelada', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

function newTempId() {
  return Math.random().toString(36).slice(2, 10);
}

export const SolicitacaoClassificacaoLoteDialog: React.FC<Props> = ({
  open,
  loteId,
  viewOnly,
  onOpenChange,
}) => {
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const can = (a: 'visualizar' | 'criar' | 'editar' | 'excluir') =>
    isSuperAdmin || hasActionPermission(BASE_PERMISSION, a);

  const isCreate = !loteId;
  const detailQuery = useSolicitacaoClassificacaoLote(loteId);
  const criarRascunhoMut = useCriarRascunhoClassificacaoLote();
  const atualizarObsMut = useAtualizarObservacoesRascunho();
  const emitirMut = useEmitirSolicitacaoClassificacaoLote();

  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemRascunhoEmMemoria[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // CCs do escopo do usuário
  const { data: ccIds = [] } = useQuery({
    queryKey: ['user-ccs-escopo'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        'fn_ativos_user_centros_custo_responsavel',
      );
      if (error) throw error;
      return ((data as any[]) || []).map((r) => r.centro_custo_id as string);
    },
    enabled: open,
  });

  // Funcionários no escopo
  const { data: funcionariosEscopo = [] } = useQuery({
    queryKey: ['funcionarios-escopo-classificacao', ccIds],
    queryFn: async (): Promise<FuncionarioEscopo[]> => {
      if (ccIds.length === 0) return [];
      const { data, error } = await supabase
        .from('bd_funcionarios')
        .select(
          'id, nome_completo, centro_custo_id, funcao_id, empresa_id, status, data_admissao, salario_base, bd_centros_custo:centro_custo_id(codigo_centro_custo, nome_centro_custo), bd_funcoes:funcao_id(nome_funcao), bd_empresas:empresa_id(nome_empresa, logo_url)',
        )
        .in('centro_custo_id', ccIds)
        .in('status', ['Ativo', 'Ativo sem Registro'])
        .order('nome_completo');
      if (error) throw error;
      return (data || []).map((f: any) => ({
        id: f.id,
        nome_completo: f.nome_completo,
        centro_custo_id: f.centro_custo_id,
        funcao_id: f.funcao_id,
        cc_label: f.bd_centros_custo
          ? `${f.bd_centros_custo.codigo_centro_custo} - ${f.bd_centros_custo.nome_centro_custo}`
          : '-',
        funcao_nome: f.bd_funcoes?.nome_funcao ?? null,
        empresa_id: f.empresa_id ?? null,
        empresa_nome: f.bd_empresas?.nome_empresa ?? null,
        empresa_logo_url: f.bd_empresas?.logo_url ?? null,
        data_admissao: f.data_admissao ?? null,
        salario_base: f.salario_base != null ? Number(f.salario_base) : null,
      }));
    },
    enabled: open && ccIds.length >= 0,
  });

  // Funções (cargos novos disponíveis)
  const { data: funcoes = [] } = useQuery({
    queryKey: ['bd_funcoes_classificacao_lote'],
    queryFn: async (): Promise<Funcao[]> => {
      const { data, error } = await supabase
        .from('bd_funcoes')
        .select('id, nome_funcao, salario_base')
        .order('nome_funcao');
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: open,
  });

  const funcaoMap = useMemo(() => {
    const m = new Map<string, Funcao>();
    for (const f of funcoes) m.set(f.id, f);
    return m;
  }, [funcoes]);

  const funcionarioMap = useMemo(() => {
    const m = new Map<string, FuncionarioEscopo>();
    for (const f of funcionariosEscopo) m.set(f.id, f);
    return m;
  }, [funcionariosEscopo]);

  // Hidratar quando abrir
  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setObservacoes('');
      setItens([]);
      setSearchTerm('');
      return;
    }
    if (detailQuery.data) {
      setObservacoes(detailQuery.data.header.observacoes ?? '');
      setItens(
        detailQuery.data.itens.map((it) => ({
          tempId: it.id,
          funcionario_id: it.funcionario_id,
          funcionario_nome:
            funcionarioMap.get(it.funcionario_id)?.nome_completo ?? '—',
          centro_custo_id: it.centro_custo_id,
          centro_custo_label:
            funcionarioMap.get(it.funcionario_id)?.cc_label ?? '—',
          cargo_atual_id: it.cargo_atual_id,
          cargo_atual_nome: it.cargo_atual_nome,
          cargo_novo_id: it.cargo_novo_id,
          cargo_novo_nome: it.cargo_novo_nome,
          motivo: it.motivo,
          observacao: it.observacao,
          data_efetivacao_desejada: it.data_efetivacao_desejada,
          precisa_exame: it.precisa_exame,
          salario_atual:
            (it as any).salario_atual != null
              ? Number((it as any).salario_atual)
              : funcionarioMap.get(it.funcionario_id)?.salario_base ?? null,
          salario_novo:
            (it as any).salario_novo != null
              ? Number((it as any).salario_novo)
              : funcaoMap.get(it.cargo_novo_id)?.salario_base ?? null,
          data_admissao:
            funcionarioMap.get(it.funcionario_id)?.data_admissao ?? null,
        })),
      );
    }
  }, [open, isCreate, detailQuery.data, funcionarioMap, funcaoMap]);

  const header = detailQuery.data?.header;
  const totalItensPersistidos = detailQuery.data?.itens.length ?? 0;
  const inconsistente =
    !!header && header.status === 'rascunho' && totalItensPersistidos > 0;
  const readonlyMode =
    viewOnly ||
    (!!header && header.status !== 'rascunho') ||
    inconsistente;

  const statusKey = header?.status ?? 'rascunho';
  const badgeMeta = statusBadge[statusKey] ?? statusBadge.rascunho;

  const adicionarFuncionario = (funcId: string) => {
    if (itens.some((i) => i.funcionario_id === funcId)) return;
    const f = funcionarioMap.get(funcId);
    if (!f) return;
    setItens((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        funcionario_id: f.id,
        funcionario_nome: f.nome_completo,
        centro_custo_id: f.centro_custo_id,
        centro_custo_label: f.cc_label,
        cargo_atual_id: f.funcao_id,
        cargo_atual_nome: f.funcao_nome,
        cargo_novo_id: '',
        cargo_novo_nome: '',
        motivo: 'Promoção',
        observacao: null,
        data_efetivacao_desejada: null,
        precisa_exame: false,
        salario_atual: f.salario_base ?? null,
        salario_novo: null,
        data_admissao: f.data_admissao ?? null,
      },
    ]);
  };

  const removerItem = (tempId: string) => {
    setItens((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const atualizarItem = (
    tempId: string,
    patch: Partial<ItemRascunhoEmMemoria>,
  ) => {
    setItens((prev) =>
      prev.map((i) => (i.tempId === tempId ? { ...i, ...patch } : i)),
    );
  };

  const handleSelecionarCargoNovo = (tempId: string, funcId: string) => {
    const f = funcaoMap.get(funcId);
    atualizarItem(tempId, {
      cargo_novo_id: funcId,
      cargo_novo_nome: f?.nome_funcao ?? '',
      salario_novo: f?.salario_base != null ? Number(f.salario_base) : null,
    });
  };

  // Salvar rascunho — NUNCA grava itens
  const handleSalvarRascunho = async () => {
    if (readonlyMode) return;
    if (!can(isCreate ? 'criar' : 'editar')) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    const fazer = async () => {
      try {
        if (isCreate) {
          await criarRascunhoMut.mutateAsync({ observacoes: observacoes || null });
        } else if (loteId) {
          await atualizarObsMut.mutateAsync({
            id: loteId,
            observacoes: observacoes || null,
          });
        }
        onOpenChange(false);
      } catch {
        /* toast no hook */
      }
    };
    if (itens.length > 0) {
      const ok = window.confirm(
        'Nesta fase, os itens só serão gravados ao emitir a solicitação. O rascunho salva apenas as observações. Deseja continuar?',
      );
      if (!ok) return;
    }
    fazer();
  };

  const itensValidos = useMemo(
    () =>
      itens.filter(
        (it) => it.funcionario_id && it.cargo_novo_id && it.motivo,
      ),
    [itens],
  );

  const validarParaEmissao = (): string | null => {
    if (itens.length === 0) return 'Inclua pelo menos 1 funcionário antes de emitir.';
    const ids = new Set<string>();
    for (const it of itens) {
      if (!it.funcionario_id) return 'Há item sem funcionário selecionado.';
      if (ids.has(it.funcionario_id)) {
        return `Funcionário duplicado: ${it.funcionario_nome}.`;
      }
      ids.add(it.funcionario_id);
      if (!it.centro_custo_id) return 'Item sem centro de custo resolvido.';
      if (!ccIds.includes(it.centro_custo_id)) {
        return `Funcionário ${it.funcionario_nome} fora do seu escopo de centro de custo.`;
      }
      if (!it.cargo_novo_id) return `Selecione o novo cargo de ${it.funcionario_nome}.`;
      if (!it.motivo) return `Selecione o motivo de ${it.funcionario_nome}.`;
      if (it.data_efetivacao_desejada) {
        const d = new Date(it.data_efetivacao_desejada);
        if (isNaN(d.getTime())) return 'Data de efetivação inválida.';
      }
    }
    return null;
  };

  const handleEmitir = async () => {
    if (readonlyMode) return;
    if (!can('editar')) {
      toast.error('Você não tem permissão para emitir.');
      return;
    }
    const erro = validarParaEmissao();
    if (erro) {
      toast.error(erro);
      return;
    }
    try {
      await emitirMut.mutateAsync({
        id: loteId,
        observacoes: observacoes || null,
        itens,
      });
      onOpenChange(false);
    } catch {
      /* toast no hook */
    }
  };

  const [pdfPending, setPdfPending] = useState(false);

  const isPending =
    criarRascunhoMut.isPending ||
    atualizarObsMut.isPending ||
    emitirMut.isPending;

  const funcoesOptions = useMemo(
    () => funcoes.map((f) => ({ value: f.id, label: f.nome_funcao })),
    [funcoes],
  );

  // Fase 2C: PDF — sem mutação, sem chamadas a exames.
  const handleGerarPdf = async () => {
    if (!can('visualizar')) {
      toast.error('Você não tem permissão para gerar o PDF.');
      return;
    }
    if (itens.length === 0) {
      toast.error('Inclua pelo menos 1 funcionário antes de gerar o PDF.');
      return;
    }
    // Validação mínima por item (apenas para PDF — não bloqueia rascunho)
    for (const it of itens) {
      if (!it.funcionario_id) {
        toast.error('Há item sem funcionário.');
        return;
      }
      if (!it.cargo_novo_id) {
        toast.error(`Selecione o novo cargo de ${it.funcionario_nome}.`);
        return;
      }
      if (!it.motivo) {
        toast.error(`Selecione o motivo de ${it.funcionario_nome}.`);
        return;
      }
    }
    setPdfPending(true);
    try {
      // Última classificação (consulta em lote, somente leitura)
      const ultimaPorFuncionario = new Map<string, string>();
      try {
        const { data: hist } = await supabase
          .from('bd_historico_funcional')
          .select('funcionario_id, created_at')
          .in(
            'funcionario_id',
            itens.map((i) => i.funcionario_id),
          )
          .order('created_at', { ascending: false });
        for (const h of (hist || []) as any[]) {
          if (!ultimaPorFuncionario.has(h.funcionario_id)) {
            ultimaPorFuncionario.set(h.funcionario_id, h.created_at);
          }
        }
      } catch (err) {
        console.warn('[CLASSIFICACAO_LOTE_PDF] falha ao buscar histórico', err);
      }

      const itensPdf = itens.map((it) => {
        const f = funcionarioMap.get(it.funcionario_id);
        return {
          funcionario_nome: it.funcionario_nome,
          data_admissao: it.data_admissao ?? f?.data_admissao ?? null,
          ultima_classificacao:
            ultimaPorFuncionario.get(it.funcionario_id) ?? null,
          salario_atual: it.salario_atual ?? f?.salario_base ?? null,
          salario_novo:
            it.salario_novo ??
            (funcaoMap.get(it.cargo_novo_id)?.salario_base != null
              ? Number(funcaoMap.get(it.cargo_novo_id)!.salario_base)
              : null),
          empresa_id: f?.empresa_id ?? null,
          empresa_nome: f?.empresa_nome ?? null,
          empresa_logo_url: f?.empresa_logo_url ?? null,
          centro_custo_label: it.centro_custo_label,
          cargo_atual_nome: it.cargo_atual_nome,
          cargo_novo_nome: it.cargo_novo_nome,
          motivo: it.motivo,
          data_efetivacao_desejada: it.data_efetivacao_desejada,
          precisa_exame: it.precisa_exame,
          observacao: it.observacao,
        };
      });

      const [logoMap, logoDefault] = await Promise.all([
        buildLogoMapFromItens(itensPdf),
        loadLytoraneaDefaultLogo(),
      ]);

      const isPrevia = !header || header.status === 'rascunho';
      const dataSolicitacao = header?.data_solicitacao
        ? new Date(header.data_solicitacao)
        : new Date();

      await gerarPdfSolicitacaoClassificacaoLote({
        protocolo: header?.protocolo ?? null,
        status: header?.status ?? 'rascunho',
        data_solicitacao: dataSolicitacao,
        solicitante: header?.solicitante_nome_snapshot ?? null,
        observacoes_gerais: observacoes || null,
        itens: itensPdf,
        is_previa: isPrevia,
        logoMap,
        logoDefault,
      });
    } catch (err) {
      console.error('[CLASSIFICACAO_LOTE_PDF] erro ao gerar PDF', err);
      toast.error('Falha ao gerar PDF.');
    } finally {
      setPdfPending(false);
    }
  };

  // Lista filtrada da busca (esquerda)
  const funcionariosFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return funcionariosEscopo;
    return funcionariosEscopo.filter(
      (f) =>
        f.nome_completo.toLowerCase().includes(q) ||
        (f.funcao_nome?.toLowerCase().includes(q) ?? false) ||
        f.cc_label.toLowerCase().includes(q),
    );
  }, [funcionariosEscopo, searchTerm]);

  const handleClose = (next: boolean) => {
    if (!next) {
      setItens([]);
      setObservacoes('');
      setSearchTerm('');
    }
    onOpenChange(next);
  };

  const titulo = isCreate
    ? 'Nova Solicitação de Classificação em Lote'
    : viewOnly
      ? `Visualizar Solicitação — ${header?.protocolo ?? ''}`
      : `Editar Rascunho — ${header?.protocolo ?? ''}`;

  const renderBuscaLista = () => {
    if (funcionariosEscopo.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4 text-center">
          <User className="h-7 w-7 mb-2" />
          <p className="text-sm">Nenhum funcionário no seu escopo.</p>
        </div>
      );
    }
    if (funcionariosFiltrados.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4 text-center">
          <User className="h-7 w-7 mb-2" />
          <p className="text-sm">Nenhum funcionário encontrado.</p>
        </div>
      );
    }
    return (
      <div className="p-2 space-y-1">
        {funcionariosFiltrados.map((f) => {
          const already = itens.some((i) => i.funcionario_id === f.id);
          return (
            <div
              key={f.id}
              className="p-2 rounded-md border bg-background flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{f.nome_completo}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {f.funcao_nome || 'Sem função'} · {f.cc_label}
                </p>
              </div>
              <Button
                size="sm"
                variant={already ? 'secondary' : 'default'}
                disabled={already}
                onClick={() => adicionarFuncionario(f.id)}
                type="button"
              >
                {already ? (
                  'Adicionado'
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-3">
              {titulo}
              {header && (
                <Badge variant="outline" className={badgeMeta.cls}>
                  {badgeMeta.label}
                </Badge>
              )}
            </span>
          </DialogTitle>
          <DialogDescription>
            Rascunho salva apenas observações. Itens são gravados somente ao emitir
            a solicitação.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {inconsistente && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Lote em estado inconsistente</AlertTitle>
                <AlertDescription>
                  Este rascunho contém itens — provavelmente uma emissão anterior
                  falhou no passo final. Todas as ações de mutação estão
                  bloqueadas. Apenas visualização permitida.
                </AlertDescription>
              </Alert>
            )}

            {header && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{header.protocolo}</Badge>
                {header.solicitante_nome_snapshot && (
                  <Badge variant="outline">
                    Solicitante: {header.solicitante_nome_snapshot}
                  </Badge>
                )}
              </div>
            )}

            <div
              className={`grid gap-4 ${readonlyMode ? '' : 'lg:grid-cols-[340px_1fr]'}`}
            >
              {!readonlyMode && (
                <div className="space-y-2">
                  <Label>Buscar funcionários</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nome, função ou centro de custo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <ScrollArea className="h-[480px] border rounded-md">
                    {renderBuscaLista()}
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">
                    Lista respeita o escopo do usuário (SuperAdm vê tudo).
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Funcionários na solicitação ({itens.length})</Label>
                </div>

                {itens.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground text-sm border-dashed">
                    {readonlyMode
                      ? 'Sem itens.'
                      : 'Adicione funcionários da busca à esquerda.'}
                  </Card>
                ) : (
                  <ScrollArea className="h-[480px] pr-2">
                    <div className="space-y-2">
                      {itens.map((it) => {
                        const salarioRef = funcaoMap.get(it.cargo_novo_id)
                          ?.salario_base;
                        return (
                          <Card key={it.tempId} className="p-3 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {it.funcionario_nome}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {it.cargo_atual_nome || 'Sem função atual'} ·{' '}
                                  {it.centro_custo_label || '—'}
                                </p>
                              </div>
                              {!readonlyMode && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={() => removerItem(it.tempId)}
                                  type="button"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Novo cargo *</Label>
                                {readonlyMode ? (
                                  <Input value={it.cargo_novo_nome || '—'} disabled />
                                ) : (
                                  <Combobox
                                    options={funcoesOptions}
                                    value={it.cargo_novo_id}
                                    onChange={(v) =>
                                      handleSelecionarCargoNovo(it.tempId, v)
                                    }
                                    placeholder="Selecione..."
                                    searchPlaceholder="Buscar cargo..."
                                    emptyText="Nenhum cargo."
                                  />
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Motivo *</Label>
                                {readonlyMode ? (
                                  <Input value={it.motivo} disabled />
                                ) : (
                                  <Select
                                    value={it.motivo}
                                    onValueChange={(v) =>
                                      atualizarItem(it.tempId, { motivo: v })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {MOTIVOS.map((m) => (
                                        <SelectItem key={m} value={m}>
                                          {m}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  Data de efetivação desejada
                                </Label>
                                <Input
                                  type="date"
                                  disabled={readonlyMode}
                                  value={it.data_efetivacao_desejada ?? ''}
                                  onChange={(e) =>
                                    atualizarItem(it.tempId, {
                                      data_efetivacao_desejada:
                                        e.target.value || null,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Salário atual:{' '}
                              <span className="font-medium">
                                {it.salario_atual != null
                                  ? Number(it.salario_atual).toLocaleString('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL',
                                    })
                                  : '—'}
                              </span>
                              {' · '}Novo salário:{' '}
                              <span className="font-medium">
                                {(it.salario_novo ?? salarioRef) != null
                                  ? Number(it.salario_novo ?? salarioRef).toLocaleString(
                                      'pt-BR',
                                      { style: 'currency', currency: 'BRL' },
                                    )
                                  : '—'}
                              </span>
                            </p>

                            <div className="pt-2 border-t space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Label className="text-xs font-semibold">
                                  Precisa de exame?
                                </Label>
                                <RadioGroup
                                  className="flex items-center gap-4"
                                  value={it.precisa_exame ? 'sim' : 'nao'}
                                  disabled={readonlyMode}
                                  onValueChange={(v) =>
                                    atualizarItem(it.tempId, {
                                      precisa_exame: v === 'sim',
                                    })
                                  }
                                >
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem
                                      value="nao"
                                      id={`exame-nao-${it.tempId}`}
                                    />
                                    <Label
                                      htmlFor={`exame-nao-${it.tempId}`}
                                      className="text-xs font-normal cursor-pointer"
                                    >
                                      Não
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <RadioGroupItem
                                      value="sim"
                                      id={`exame-sim-${it.tempId}`}
                                    />
                                    <Label
                                      htmlFor={`exame-sim-${it.tempId}`}
                                      className="text-xs font-normal cursor-pointer"
                                    >
                                      Sim
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                Indica apenas necessidade manual de agendamento.
                                Nenhum agendamento é criado automaticamente.
                              </p>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Observação do item</Label>
                              <Textarea
                                rows={2}
                                disabled={readonlyMode}
                                value={it.observacao ?? ''}
                                onChange={(e) =>
                                  atualizarItem(it.tempId, {
                                    observacao: e.target.value || null,
                                  })
                                }
                                placeholder="Opcional"
                              />
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}

                <div className="space-y-1 pt-2">
                  <Label>Observações gerais da solicitação</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    disabled={readonlyMode}
                    rows={2}
                    placeholder="Observações do lote (opcional)"
                  />
                  {!readonlyMode && (
                    <p className="text-xs text-muted-foreground">
                      Rascunho salva apenas observações. Itens são gravados somente
                      ao emitir.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={isPending || pdfPending}
          >
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={handleGerarPdf}
            disabled={isPending || pdfPending || itens.length === 0}
            type="button"
          >
            {pdfPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Gerar PDF
          </Button>
          {!readonlyMode && (
            <>
              <Button
                variant="outline"
                onClick={handleSalvarRascunho}
                disabled={isPending || pdfPending}
              >
                Salvar rascunho
              </Button>
              <Button
                onClick={handleEmitir}
                disabled={isPending || pdfPending || itensValidos.length === 0}
              >
                Emitir solicitação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
