// Gestão de POPs — criação, revisão, publicação, descarte, obsolescência e reativação.
// Nenhuma escrita direta em tabela: apenas RPCs e Edge Functions.

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Archive,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ActionGuard from '@/components/permissoes/ActionGuard';
import { usePermission } from '@/hooks/usePermission';
import { usePopsGate, usePopsGestao, useInvalidatePops } from '@/hooks/pops/usePopsData';
import {
  descartarRascunho,
  excluirPop,
  iniciarRevisao,
  publicarRascunho,
  reativarPop,
  tornarObsoleto,
} from '@/services/popsService';
import {
  formatVersao,
  podeIniciarRevisao,
  podePublicar,
  proximaVersao,
  statusLabel,
  statusVariant,
} from '@/utils/pops/versao';
import PopFormDialog from './PopFormDialog';
import PopViewerDialog from './PopViewerDialog';
import type { PopComRascunho } from '@/types/pops';

type AcaoTexto = 'revisao' | 'descarte' | 'obsoleto';

const PopsGestaoPage: React.FC = () => {
  const { toast } = useToast();
  const invalidate = useInvalidatePops();
  const { hasActionPermission } = usePermission();
  const { data: disponivel, isLoading: gateLoading } = usePopsGate();
  const habilitado = disponivel === true;
  const { data: pops = [], isLoading } = usePopsGestao(habilitado);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [formPop, setFormPop] = useState<PopComRascunho | null>(null);
  const [viewerPop, setViewerPop] = useState<PopComRascunho | null>(null);
  const [viewerOrigem, setViewerOrigem] = useState<'vigente' | 'rascunho'>('vigente');

  const [acao, setAcao] = useState<AcaoTexto | null>(null);
  const [acaoPop, setAcaoPop] = useState<PopComRascunho | null>(null);
  const [texto, setTexto] = useState('');
  const [tipoIncremento, setTipoIncremento] = useState<'minor' | 'major'>('minor');
  const [processando, setProcessando] = useState(false);

  // Exclusão definitiva (cascata)
  const [exclusaoPop, setExclusaoPop] = useState<PopComRascunho | null>(null);
  const [exclusaoCodigo, setExclusaoCodigo] = useState('');
  const [exclusaoMotivo, setExclusaoMotivo] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pops.filter((p) => {
      const okStatus = statusFiltro === 'todos' || p.status === statusFiltro;
      const okTermo =
        !termo ||
        p.codigo.toLowerCase().includes(termo) ||
        p.titulo.toLowerCase().includes(termo);
      return okStatus && okTermo;
    });
  }, [pops, busca, statusFiltro]);

  const abrirAcao = (tipo: AcaoTexto, pop: PopComRascunho) => {
    setAcao(tipo);
    setAcaoPop(pop);
    setTexto('');
    setTipoIncremento('minor');
  };

  const fecharAcao = () => {
    setAcao(null);
    setAcaoPop(null);
    setTexto('');
  };

  const executarAcao = async () => {
    if (!acao || !acaoPop) return;
    if (texto.trim().length < 5) {
      toast({
        title: 'Justificativa obrigatória',
        description: 'Descreva o motivo com pelo menos 5 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    setProcessando(true);
    try {
      if (acao === 'revisao') {
        await iniciarRevisao({
          pop_id: acaoPop.id,
          tipo_incremento: tipoIncremento,
          motivo: texto.trim(),
        });
        toast({ title: 'Revisão aberta', description: 'A revisão está em preparação.' });
      } else if (acao === 'descarte') {
        await descartarRascunho(acaoPop.id, texto.trim());
        toast({ title: 'Revisão descartada', description: 'O documento vigente permanece intacto.' });
      } else {
        await tornarObsoleto(acaoPop.id, texto.trim());
        toast({ title: 'POP marcado como obsoleto' });
      }
      invalidate();
      fecharAcao();
    } catch (e: any) {
      toast({
        title: 'Operação não concluída',
        description: e?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };

  const handlePublicar = async (pop: PopComRascunho) => {
    if (!podePublicar(pop.rascunho?.arquivo_path)) {
      toast({
        title: 'Anexe o PDF',
        description: 'A publicação exige o documento anexado à revisão.',
        variant: 'destructive',
      });
      return;
    }
    setProcessando(true);
    try {
      const res = await publicarRascunho(pop.id);
      toast({
        title: 'POP publicado',
        description: `Versão vigente ${formatVersao(res.versao_major, res.versao_minor)}.`,
      });
      invalidate();
    } catch (e: any) {
      toast({
        title: 'Publicação bloqueada',
        description: e?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };

  const handleReativar = async (pop: PopComRascunho) => {
    setProcessando(true);
    try {
      await reativarPop(pop.id);
      toast({ title: 'POP reativado', description: 'A versão vigente foi mantida.' });
      invalidate();
    } catch (e: any) {
      toast({
        title: 'Não foi possível reativar',
        description: e?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };

  const abrirExclusao = (pop: PopComRascunho) => {
    setExclusaoPop(pop);
    setExclusaoCodigo('');
    setExclusaoMotivo('');
  };

  const fecharExclusao = () => {
    setExclusaoPop(null);
    setExclusaoCodigo('');
    setExclusaoMotivo('');
  };

  const codigoConfirmado =
    Boolean(exclusaoPop) &&
    exclusaoCodigo.trim().toUpperCase() === (exclusaoPop?.codigo || '').trim().toUpperCase();
  const exclusaoValida = codigoConfirmado && exclusaoMotivo.trim().length >= 10;

  const handleExcluir = async () => {
    if (!exclusaoPop || !exclusaoValida) return;
    setProcessando(true);
    try {
      await excluirPop(exclusaoPop.id, exclusaoMotivo.trim());
      toast({
        title: 'POP excluído',
        description: `${exclusaoPop.codigo} e seus arquivos foram removidos definitivamente.`,
      });
      invalidate();
      fecharExclusao();
    } catch (e: any) {
      toast({
        title: 'Exclusão não concluída',
        description: e?.message || 'Erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setProcessando(false);
    }
  };



  if (gateLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!habilitado) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          O módulo de POPs está em homologação e ainda não foi liberado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              className="md:col-span-2"
              placeholder="Buscar por código ou título"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                <SelectItem value="ativo">Vigentes</SelectItem>
                <SelectItem value="rascunho">Em preparação</SelectItem>
                <SelectItem value="obsoleto">Obsoletos</SelectItem>
              </SelectContent>
            </Select>
            <ActionGuard permission="pops_view" action="criar">
              <Button
                onClick={() => {
                  setFormPop(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo POP
              </Button>
            </ActionGuard>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Procedimentos ({filtrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-6 w-6" />
              Nenhum POP encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Vigente</TableHead>
                    <TableHead>Em preparação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((p) => {
                    const r = p.rascunho;
                    const proxima = r
                      ? proximaVersao(
                          { major: p.versao_major, minor: p.versao_minor },
                          r.tipo_incremento,
                        )
                      : null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.codigo}</TableCell>
                        <TableCell>{p.titulo}</TableCell>
                        <TableCell>{p.setor_nome || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.publicado_em ? formatVersao(p.versao_major, p.versao_minor) : '—'}
                        </TableCell>
                        <TableCell>
                          {r && proxima ? (
                            <span className="text-sm text-muted-foreground">
                              → {formatVersao(proxima.major, proxima.minor)}
                              {r.arquivo_path ? ' (PDF anexado)' : ' (sem PDF)'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Ações do POP">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {p.arquivo_path && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setViewerOrigem('vigente');
                                    setViewerPop(p);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver vigente
                                </DropdownMenuItem>
                              )}
                              {r?.arquivo_path && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setViewerOrigem('rascunho');
                                    setViewerPop(p);
                                  }}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver revisão
                                </DropdownMenuItem>
                              )}
                              {r && hasActionPermission('pops_view', 'editar') && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFormPop(p);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar revisão
                                </DropdownMenuItem>
                              )}
                              {r && hasActionPermission('pops_view', 'aprovar') && (
                                <DropdownMenuItem
                                  onClick={() => handlePublicar(p)}
                                  disabled={processando}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Publicar revisão
                                </DropdownMenuItem>
                              )}
                              {r && hasActionPermission('pops_view', 'editar') && (
                                <DropdownMenuItem onClick={() => abrirAcao('descarte', p)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Descartar revisão
                                </DropdownMenuItem>
                              )}
                              {podeIniciarRevisao(p.status, Boolean(r)) &&
                                hasActionPermission('pops_view', 'editar') && (
                                  <DropdownMenuItem onClick={() => abrirAcao('revisao', p)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Iniciar revisão
                                  </DropdownMenuItem>
                                )}
                              {p.status === 'ativo' && hasActionPermission('pops_view', 'aprovar') && (
                                <DropdownMenuItem onClick={() => abrirAcao('obsoleto', p)}>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Tornar obsoleto
                                </DropdownMenuItem>
                              )}
                              {p.status === 'obsoleto' &&
                                hasActionPermission('pops_view', 'aprovar') && (
                                  <DropdownMenuItem
                                    onClick={() => handleReativar(p)}
                                    disabled={processando}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reativar
                                  </DropdownMenuItem>
                                )}
                              {hasActionPermission('pops_view', 'aprovar') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => abrirExclusao(p)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir POP
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PopFormDialog open={formOpen} onOpenChange={setFormOpen} pop={formPop} />

      <PopViewerDialog
        pop={viewerPop}
        origem={viewerOrigem}
        open={Boolean(viewerPop)}
        onOpenChange={(o) => !o && setViewerPop(null)}
      />

      <Dialog open={Boolean(acao)} onOpenChange={(o) => !o && fecharAcao()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao === 'revisao'
                ? 'Iniciar revisão'
                : acao === 'descarte'
                  ? 'Descartar revisão em preparação'
                  : 'Tornar POP obsoleto'}
            </DialogTitle>
            <DialogDescription>
              {acao === 'revisao'
                ? 'Uma nova revisão será criada sem alterar o documento vigente.'
                : acao === 'descarte'
                  ? 'A revisão e o PDF temporário serão removidos. O vigente permanece intacto.'
                  : 'O documento deixa de ser vigente, preservando versão e arquivo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {acao === 'revisao' && (
              <div className="space-y-2">
                <Label>Tipo de incremento</Label>
                <Select
                  value={tipoIncremento}
                  onValueChange={(v) => setTipoIncremento(v as 'minor' | 'major')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor (ajustes)</SelectItem>
                    <SelectItem value="major">Major (mudança estrutural)</SelectItem>
                  </SelectContent>
                </Select>
                {acaoPop && (
                  <p className="text-xs text-muted-foreground">
                    Publicando, a versão passará de{' '}
                    {formatVersao(acaoPop.versao_major, acaoPop.versao_minor)} para{' '}
                    {(() => {
                      const p = proximaVersao(
                        { major: acaoPop.versao_major, minor: acaoPop.versao_minor },
                        tipoIncremento,
                      );
                      return formatVersao(p.major, p.minor);
                    })()}
                    .
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pop-acao-motivo">Justificativa</Label>
              <Textarea
                id="pop-acao-motivo"
                rows={4}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Descreva o motivo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharAcao} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={executarAcao} disabled={processando}>
              {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(exclusaoPop)} onOpenChange={(o) => !o && fecharExclusao()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir POP definitivamente</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível: o documento vigente, a revisão em preparação e todos os
              PDFs deste POP serão removidos. O registro de auditoria é preservado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pop-exclusao-codigo">
                Digite o código <span className="font-semibold">{exclusaoPop?.codigo}</span> para
                confirmar
              </Label>
              <Input
                id="pop-exclusao-codigo"
                value={exclusaoCodigo}
                onChange={(e) => setExclusaoCodigo(e.target.value)}
                placeholder={exclusaoPop?.codigo || ''}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pop-exclusao-motivo">Motivo da exclusão (mín. 10 caracteres)</Label>
              <Textarea
                id="pop-exclusao-motivo"
                rows={3}
                value={exclusaoMotivo}
                onChange={(e) => setExclusaoMotivo(e.target.value)}
                placeholder="Ex.: arquivo PDF incorreto enviado no cadastro inicial"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={fecharExclusao} disabled={processando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleExcluir}
              disabled={processando || !exclusaoValida}
            >
              {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default PopsGestaoPage;
