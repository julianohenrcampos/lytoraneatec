import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { toast } from "sonner";
import { analisarPeriodo } from "@/utils/diariasPeriodoUtils";
import { calcularEstimativaPorConvocadosPre } from "@/utils/diariasEstimativaPorConvocadosPre";
import { itemConvocadoNaData } from "@/utils/diariasDiasSolicitadosFallback";
import { useFeriadosPeriodo } from "@/hooks/diarias/useFeriados";
import {
  Calendar,
  Building2,
  Users,
  User,
  Clock,
  DollarSign,
  CalendarCheck,
  CalendarX,
  CalendarDays,
  CalendarPlus,
  FileText,
  Check,
  X,
  MessageSquare,
  FileDown,
  Loader2,
  UserMinus
} from "lucide-react";
import { lerConvocadosPre, derivarFuncionariosPlanos } from "@/lib/diarias/convocadosPreAdapter";
import { DIARIAS_LOTES_UI_PREVIEW } from "@/config/diariasFlags";
import { LotesPreviewPanel } from "@/components/diarias/preview/LotesPreviewPanel";
import { AditivoSolicitarModal } from "@/components/diarias/AditivoSolicitarModal";
import { AditivoConfirmacaoModal } from "@/components/diarias/AditivoConfirmacaoModal";
import { useAditivos } from "@/hooks/diarias/useAditivos";
import { usePermission } from "@/hooks/usePermission";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDiariasDataScope } from "@/hooks/diarias/useDiariasDataScope";


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EstimativaAviso } from "./EstimativaAviso";
import { generateSolicitacaoPDF } from "@/services/pdfService";

import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

const TIPO_ADITIVO_LABEL: Record<string, string> = {
  adicionar_dia: 'Adição de dia',
  remover_dia: 'Remoção de dia',
  adicionar_funcionario: 'Inclusão de funcionário',
  remover_funcionario: 'Remoção de funcionário',
  // Aliases legados
  funcionario_inclusao: 'Inclusão de funcionário',
  funcionario_remocao: 'Remoção de funcionário',
};
import type { DiariaSolicitacao, FuncionarioPreConvocado } from "@/types/diarias";
import { removerFuncionarioConvocado } from "@/services/diarias/solicitacoesService";
import { useSincronizarDiarias } from "@/hooks/diarias/useSincronizarDiarias";

interface SolicitacaoDetalhesModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitacao: DiariaSolicitacao | null;
  onAutorizar?: (solicitacao: DiariaSolicitacao) => void;
  onReprovar?: (solicitacao: DiariaSolicitacao) => void;
  canAutorizar?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function SolicitacaoDetalhesModal({
  isOpen,
  onClose,
  solicitacao,
  onAutorizar,
  onReprovar,
  canAutorizar = false
}: SolicitacaoDetalhesModalProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [removingFuncId, setRemovingFuncId] = useState<string | null>(null);
  const [aditivoOpen, setAditivoOpen] = useState(false);
  const [aditivoAnaliseId, setAditivoAnaliseId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const sincronizarDiarias = useSincronizarDiarias();
  const { hasActionPermission, isSuperAdmin } = usePermission();
  const { user: profile } = useUserProfile();
  const { centrosCustoGerenciados, scopeFilters } = useDiariasDataScope();
  // Gate combinado (paridade com DiariasSolicitacoes.tsx): RBAC + escopo de CC.
  // Antes restringia somente a SuperAdm/acesso_global, escondendo o botão
  // "Analisar" do GerenteRegional aprovador formal do CC.
  const allowedCentroIds = ((centrosCustoGerenciados?.length
    ? centrosCustoGerenciados
    : (scopeFilters?.centro_custo_ids ?? [])) as string[]);
  const bypassAditivo = isSuperAdmin || !!profile?.acesso_global;
  const podeAprovarAditivo =
    bypassAditivo ||
    (hasActionPermission('diarias_aditivo_aprovar', 'aprovar') &&
      !!solicitacao?.centro_custo_id &&
      allowedCentroIds.includes(solicitacao.centro_custo_id));
  const { data: aditivos = [] } = useAditivos(solicitacao?.id);

  // Resolve nomes de solicitante/decisor dos aditivos (Fase I.4)
  const userIdsAditivos = useMemo(() => {
    const set = new Set<string>();
    for (const a of aditivos) {
      if (a.solicitado_por) set.add(a.solicitado_por);
      if (a.decidido_por) set.add(a.decidido_por);
    }
    return Array.from(set);
  }, [aditivos]);
  const { data: nomesAditivosMap } = useQuery({
    queryKey: ['aditivos-usuarios-nomes', userIdsAditivos.sort().join(',')],
    enabled: userIdsAditivos.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome_completo, email')
        .in('id', userIdsAditivos);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of (data ?? []) as any[]) {
        map[p.id] = p.nome_completo || p.email || '—';
      }
      return map;
    },
  });
  const podeSolicitarAditivo =
    !!solicitacao &&
    solicitacao.status === 'autorizada' &&
    hasActionPermission('diarias_aditivo_solicitar', 'criar');
  
  // Re-analisar período para obter separação sábado/domingo
  const { data: feriados = [] } = useFeriadosPeriodo(
    solicitacao?.data_inicio || '', 
    solicitacao?.data_fim || ''
  );
  
  const analise = useMemo(() => {
    if (!solicitacao) return null;
    const feriadosFormatados = feriados.map(f => ({ data: f.data, nome: f.nome }));
    return analisarPeriodo(solicitacao.data_inicio, solicitacao.data_fim, feriadosFormatados, solicitacao.considera_fds_feriado);
  }, [solicitacao?.data_inicio, solicitacao?.data_fim, feriados, solicitacao?.considera_fds_feriado]);
  // Buscar dados complementares + nomes de funcionários/funções quando não existirem no JSON
  const { data: dadosComplementares } = useQuery({
    queryKey: ['solicitacao-detalhes', solicitacao?.id],
    queryFn: async () => {
      if (!solicitacao) return null;

      // Buscar aprovador do centro de custo
      let aprovadorNome = null;
      if (solicitacao.bd_centros_custo?.id) {
        const { data: cc } = await supabase
          .from('bd_centros_custo')
          .select(`
            aprovador_diarias_id,
            aprovador:bd_funcionarios!bd_centros_custo_aprovador_diarias_id_fkey(
              id,
              nome_completo
            )
          `)
          .eq('id', solicitacao.bd_centros_custo.id)
          .maybeSingle();
        
        if (cc?.aprovador) {
          aprovadorNome = (cc.aprovador as any).nome_completo;
        }
      }

      // S1 — Nomes mínimos via RPC SECURITY DEFINER (fn_diaria_nomes_minimos).
      // Necessário porque a RLS de bd_funcionarios/profiles não libera
      // pessoas de outros departamentos para GerenteRegional, fazendo as
      // queries diretas retornarem null e os campos virarem "-".
      let apontadorNome: string | null = null;
      let engenheiroSolicitanteNome: string | null = null;
      let criadorNome: string | null = null;

      const idsParaResolver = [
        solicitacao.criado_por,
        (solicitacao as any).engenheiro_solicitante_id,
        solicitacao.responsavel_campo_id,
        (solicitacao as any).autorizado_por,
      ].filter((v): v is string => !!v);

      const nomesMap = new Map<string, string>();
      if (idsParaResolver.length > 0) {
        const { data: nomesData, error: nomesErr } = await supabase.rpc(
          'fn_diaria_nomes_minimos',
          { p_ids: idsParaResolver },
        );
        if (nomesErr) {
          console.warn(
            '[SolicitacaoDetalhesModal] fn_diaria_nomes_minimos falhou',
            nomesErr,
          );
        } else {
          for (const row of (nomesData ?? []) as Array<{
            id: string;
            nome_completo: string;
            origem: string;
          }>) {
            if (!nomesMap.has(row.id) && row.nome_completo) {
              nomesMap.set(row.id, row.nome_completo);
            }
          }
        }
      }

      if (solicitacao.criado_por) {
        criadorNome = nomesMap.get(solicitacao.criado_por) ?? null;
      }
      if ((solicitacao as any).engenheiro_solicitante_id) {
        engenheiroSolicitanteNome =
          nomesMap.get((solicitacao as any).engenheiro_solicitante_id) ?? null;
      }
      if (solicitacao.responsavel_campo_id) {
        apontadorNome = nomesMap.get(solicitacao.responsavel_campo_id) ?? null;
      }

      if (import.meta.env.DEV) {
        console.log('[AUDIT][diarias-solicitacao-modal:nomes]', {
          solicitacaoId: solicitacao.id,
          criado_por: solicitacao.criado_por,
          engenheiro_solicitante_id: (solicitacao as any).engenheiro_solicitante_id,
          responsavel_campo_id: solicitacao.responsavel_campo_id,
          autorizado_por: (solicitacao as any).autorizado_por,
          hasSolicitanteNome: !!criadorNome,
          hasEngenheiroNome: !!engenheiroSolicitanteNome,
          hasResponsavelNome: !!apontadorNome,
          nomesMapSize: nomesMap.size,
        });
      }



      // Fallback: buscar nomes de funcionários/funções se não existirem no JSON
      const convocadosRaw: FuncionarioPreConvocado[] = derivarFuncionariosPlanos(
        lerConvocadosPre(solicitacao.convocados_pre, {
          inicio: solicitacao.data_inicio,
          fim: solicitacao.data_fim,
        }),
      ).map(({ extras, ...rest }) => ({ ...(extras ?? {}), ...rest })) as unknown as FuncionarioPreConvocado[];
      
      let funcionariosMap: Record<string, string> = {};
      let funcoesMap: Record<string, string> = {};
      
      // Verificar se falta algum nome
      const funcIdsSemNome = convocadosRaw
        .filter(c => !c.nome_funcionario)
        .map(c => c.funcionario_id);
      const funcaoIdsSemNome = convocadosRaw
        .filter(c => !c.nome_funcao)
        .map(c => c.funcao_id);
      
      if (funcIdsSemNome.length > 0) {
        const { data: funcionarios } = await supabase
          .from('bd_funcionarios')
          .select('id, nome_completo')
          .in('id', funcIdsSemNome);
        
        if (funcionarios) {
          funcionarios.forEach(f => {
            funcionariosMap[f.id] = f.nome_completo;
          });
        }
      }
      
      if (funcaoIdsSemNome.length > 0) {
        const { data: funcoes } = await supabase
          .from('bd_funcoes')
          .select('id, nome_funcao')
          .in('id', funcaoIdsSemNome);
        
        if (funcoes) {
          funcoes.forEach(f => {
            funcoesMap[f.id] = f.nome_funcao;
          });
        }
      }

      return {
        aprovadorNome,
        apontadorNome,
        criadorNome,
        engenheiroSolicitanteNome,
        funcionariosMap,
        funcoesMap
      };
    },
    enabled: isOpen && !!solicitacao,
    staleTime: 30000
  });

  if (!solicitacao) return null;

  const convocadosPre: FuncionarioPreConvocado[] = derivarFuncionariosPlanos(
    lerConvocadosPre(solicitacao.convocados_pre, {
      inicio: solicitacao.data_inicio,
      fim: solicitacao.data_fim,
    }),
  ).map(({ extras, ...rest }) => ({ ...(extras ?? {}), ...rest })) as unknown as FuncionarioPreConvocado[];

  const diasUteis = solicitacao.qtde_dias_uteis_estimado || 0;
  const diasFds = solicitacao.qtde_fds_estimado || 0;
  const diasFeriados = solicitacao.qtde_feriados_estimado || 0;
  // Usar análise real do período para separar sábados de domingos
  const diasUteisReal = analise?.diasUteis || diasUteis;
  const sabadosReal = analise?.sabados || 0;
  const domingosReal = analise?.domingos || 0;
  const feriadosReal = analise?.feriados || diasFeriados;
  
  const diasNormais = diasUteisReal; // apenas dias úteis pagam diária normal
  const diasExclusivos = sabadosReal + domingosReal + feriadosReal; // sábados, domingos e feriados pagam diária exclusiva
  const consideraFdsEFeriado = solicitacao.considera_fds_feriado;

  // Fase G — fonte única de verdade: cálculo por par funcionário × data baseado em dias_solicitados.
  const estimativa = calcularEstimativaPorConvocadosPre({
    solicitacao,
    convocadosPre,
    datasClassificadas: analise?.datasClassificadas ?? [],
  });

  const totalDiariasNormais = estimativa.total_diarias_uteis;
  const totalDiariasExclusivas = estimativa.total_diarias_fds_feriados;
  const totalRefeicoes = estimativa.total_refeicoes;
  const totalGeral = estimativa.total_geral;
  const ocorrenciasUteis = estimativa.ocorrencias_uteis;
  const ocorrenciasExclusivos = estimativa.ocorrencias_exclusivos;
  const ocorrenciasRefeicao = estimativa.quantidade_pares_refeicao;
  const mostrarColunaDiariaEspecial = ocorrenciasExclusivos > 0 || (consideraFdsEFeriado && diasExclusivos > 0);
  const handleDownloadPDF = async () => {
    if (!solicitacao) return;
    
    setIsGeneratingPDF(true);
    try {
      const fileName = `Solicitacao_Diaria_${solicitacao.bd_centros_custo?.codigo_centro_custo || 'CC'}_${solicitacao.data_inicio.replace(/-/g, '')}`;
      await generateSolicitacaoPDF(
        solicitacao,
        convocadosPre,
        dadosComplementares || {},
        fileName,
        analise ? {
          diasUteis: analise.diasUteis,
          sabados: analise.sabados,
          domingos: analise.domingos,
          feriados: analise.feriados,
        } : undefined,
        estimativa,
        aditivos,
        nomesAditivosMap,
      );
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleLiberarFuncionario = async (funcionarioId: string, nomeFuncionario: string) => {
    if (!solicitacao?.id) return;
    setRemovingFuncId(funcionarioId);
    try {
      await removerFuncionarioConvocado(solicitacao.id, funcionarioId);
      await sincronizarDiarias(solicitacao.id);
      toast.success(`${nomeFuncionario} liberado da lista de convocados.`);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao liberar funcionário.');
    } finally {
      setRemovingFuncId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes da Solicitação
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="mr-4"
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <FileDown className="h-4 w-4 mr-1" />
              )}
              PDF
            </Button>
          </div>
          <DialogDescription>
            Visualize todas as informações da solicitação antes de tomar uma decisão.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable middle section */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {/* Informações Gerais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Período
                  </p>
                  <p className="font-medium">
                    {formatBrazilianDateForDisplay(solicitacao.data_inicio)}
                    {solicitacao.data_fim !== solicitacao.data_inicio && (
                      <> → {formatBrazilianDateForDisplay(solicitacao.data_fim)}</>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Centro de Custo
                  </p>
                  <p className="font-medium">
                    {solicitacao.bd_centros_custo?.codigo_centro_custo} - {solicitacao.bd_centros_custo?.nome_centro_custo}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span className="text-xs">Seg-Sex</span>
                  </div>
                  <p className="text-lg font-bold">{diasUteisReal}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarCheck className="h-3 w-3" />
                    <span className="text-xs">Sábados</span>
                  </div>
                  <p className="text-lg font-bold">{sabadosReal}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarCheck className="h-3 w-3" />
                    <span className="text-xs">Domingos</span>
                  </div>
                  <p className="text-lg font-bold">{domingosReal}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarX className="h-3 w-3" />
                    <span className="text-xs">Feriados</span>
                  </div>
                  <p className="text-lg font-bold">{feriadosReal}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Solicitante (Sistema)
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.criadorNome || solicitacao.profiles?.nome_completo || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Engenheiro Solicitante
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.engenheiroSolicitanteNome || solicitacao.engenheiro_solicitante?.nome_completo || "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Aprovador do CC
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.aprovadorNome || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Responsável em Campo
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.apontadorNome || solicitacao.responsavel_campo?.nome_completo || "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Considera FDS/Feriados
                  </p>
                  <Badge variant={consideraFdsEFeriado ? "default" : "secondary"}>
                    {consideraFdsEFeriado ? "Sim" : "Não"}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Justificativa */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Justificativa</p>
                <p className="text-sm bg-muted/30 p-3 rounded-md">
                  {solicitacao.justificativa}
                </p>
              </div>


              {/* Observação do Gerente / Motivo da Reprovação */}
              {solicitacao.status === 'reprovada' && solicitacao.observacao_gerente && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-destructive font-medium flex items-center gap-1">
                      <X className="h-3 w-3" />
                      Motivo da Reprovação
                    </p>
                    <p className="text-sm bg-red-50 border border-red-200 p-3 rounded-md text-red-700">
                      {solicitacao.observacao_gerente}
                    </p>
                  </div>
                </>
              )}

              {solicitacao.status === 'autorizada' && solicitacao.observacao_gerente && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Observação do Gerente
                    </p>
                    <p className="text-sm bg-muted/30 p-3 rounded-md">
                      {solicitacao.observacao_gerente}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Funcionários Convocados */}
          {convocadosPre.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Funcionários Convocados ({convocadosPre.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Diária Útil</TableHead>
                        {mostrarColunaDiariaEspecial && (
                          <TableHead className="text-right">Diária FDS/Fer</TableHead>
                        )}
                        {(solicitacao.status === 'autorizada' || solicitacao.status === 'enviada') && (
                          <TableHead className="text-center w-[60px]">Ação</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {convocadosPre.map((conv, idx) => (
                        <TableRow key={conv.funcionario_id || idx}>
                          <TableCell className="font-medium">
                            {conv.nome_funcionario || 
                             dadosComplementares?.funcionariosMap?.[conv.funcionario_id] || 
                             conv.funcionario_id}
                          </TableCell>
                          <TableCell>
                            {conv.nome_funcao || 
                             dadosComplementares?.funcoesMap?.[conv.funcao_id] || 
                             conv.funcao_id}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(conv.valor_diaria || 0)}
                          </TableCell>
                          {mostrarColunaDiariaEspecial && (
                            <TableCell className="text-right">
                              {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria || 0)}
                            </TableCell>
                          )}
                          {(solicitacao.status === 'autorizada' || solicitacao.status === 'enviada') && (
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleLiberarFuncionario(
                                  conv.funcionario_id, 
                                  conv.nome_funcionario || 'Funcionário'
                                )}
                                disabled={removingFuncId === conv.funcionario_id}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Liberar funcionário"
                              >
                                {removingFuncId === conv.funcionario_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserMinus className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Aditivos desta solicitação (leitura) */}
          {aditivos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4" />
                  Aditivos desta solicitação ({aditivos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {aditivos.map((a) => {
                    const tipoLabel = TIPO_ADITIVO_LABEL[a.tipo] ?? a.tipo;
                    const statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' =
                      a.status === 'aprovado' ? 'default' :
                      a.status === 'reprovado' ? 'destructive' :
                      a.status === 'cancelado' ? 'outline' :
                      'secondary';
                    const statusLabel =
                      a.status === 'aprovado' ? 'Aprovado' :
                      a.status === 'reprovado' ? 'Reprovado' :
                      a.status === 'cancelado' ? 'Cancelado' :
                      'Pendente';
                    // "Sem impacto no planejamento vigente":
                    // - reprovado/cancelado: nunca impactaram convocados_pre.
                    // - adicionar_funcionario aprovado mas que NÃO consta mais
                    //   no convocados_pre vigente para a data → foi superado
                    //   por aditivo posterior (remoção/liberação).
                    let semImpacto = false;
                    if (a.status === 'reprovado' || a.status === 'cancelado') {
                      semImpacto = true;
                    } else if (
                      a.status === 'aprovado' &&
                      (a.tipo === 'adicionar_funcionario' || (a as any).tipo === 'funcionario_inclusao') &&
                      a.funcionario_id
                    ) {
                      const itemConv = convocadosPre.find(
                        (c) => c.funcionario_id === a.funcionario_id,
                      );
                      const vigente = itemConv
                        ? itemConvocadoNaData(
                            { funcionario_id: itemConv.funcionario_id, dias_solicitados: (itemConv as any).dias_solicitados },
                            a.data_ajustada,
                            { datasClassificadas: analise?.datasClassificadas ?? [], consideraFdsFeriado: !!consideraFdsEFeriado },
                          ).convocado
                        : false;
                      semImpacto = !vigente;
                    }
                    const nomeSolicitante = a.solicitado_por ? (nomesAditivosMap?.[a.solicitado_por] ?? '—') : '—';
                    const nomeDecisor = a.decidido_por ? (nomesAditivosMap?.[a.decidido_por] ?? '—') : null;
                    const rotuloDecisao = a.status === 'aprovado'
                      ? 'Aprovado em'
                      : a.status === 'reprovado'
                      ? 'Reprovado em'
                      : a.status === 'cancelado'
                      ? 'Cancelado em'
                      : null;
                    return (
                      <div key={a.id} className="rounded-md border p-2 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{tipoLabel}</Badge>
                            <span className="text-muted-foreground text-xs">
                              {formatBrazilianDateForDisplay(a.data_ajustada)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                            {semImpacto && (
                              <Badge variant="outline" className="text-[10px] border-muted-foreground/40 text-muted-foreground">
                                Sem impacto no planejamento vigente
                              </Badge>
                            )}
                            {a.status === 'pendente' && podeAprovarAditivo && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setAditivoAnaliseId(a.id)}
                              >
                                Analisar
                              </Button>
                            )}
                          </div>
                        </div>

                        {(a.tipo === 'adicionar_funcionario' || a.tipo === 'remover_funcionario' || a.tipo === 'funcionario_inclusao' || a.tipo === 'funcionario_remocao') && (() => {
                          const snap = (a.snapshot_funcionario ?? {}) as any;
                          const nomeFunc = snap?.nome || snap?.nome_completo || '—';
                          const nomeFuncao = snap?.funcao_nome || snap?.nome_funcao || null;
                          return (
                            <div className="text-xs">
                              <span className="font-medium text-muted-foreground">Funcionário: </span>
                              <span className="text-foreground">{nomeFunc}</span>
                              {nomeFuncao && (
                                <>
                                  <span className="text-muted-foreground"> · </span>
                                  <span className="text-foreground">{nomeFuncao}</span>
                                </>
                              )}
                            </div>
                          );
                        })()}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">Solicitado em:</span>{' '}
                            {formatDateTimeBR(a.solicitado_em)}
                            {nomeSolicitante !== '—' && <> por <span className="font-medium">{nomeSolicitante}</span></>}
                          </div>
                          {rotuloDecisao && a.decidido_em && (
                            <div>
                              <span className="font-medium">{rotuloDecisao}:</span>{' '}
                              {formatDateTimeBR(a.decidido_em)}
                              {nomeDecisor && <> por <span className="font-medium">{nomeDecisor}</span></>}
                            </div>
                          )}
                        </div>

                        {a.justificativa && (
                          <p className="text-xs">
                            <span className="font-medium text-muted-foreground">Justificativa: </span>
                            <span className="text-foreground whitespace-pre-wrap">{a.justificativa}</span>
                          </p>
                        )}
                        {a.observacao_aprovador && (
                          <p className="text-xs">
                            <span className="font-medium text-muted-foreground">Observação do aprovador: </span>
                            <span className="text-foreground whitespace-pre-wrap">{a.observacao_aprovador}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Valor Total Estimado - FIXO na base */}
        <div className="flex-shrink-0 pt-2 border-t">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <DollarSign className="h-4 w-4" />
                Valor Total Estimado
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Diárias Úteis + Sáb ({ocorrenciasUteis} {ocorrenciasUteis === 1 ? 'ocorrência' : 'ocorrências'})</span>
                <span className="font-medium">{formatCurrency(totalDiariasNormais)}</span>
              </div>
              {ocorrenciasExclusivos > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span>Diárias Dom/Feriados ({ocorrenciasExclusivos} {ocorrenciasExclusivos === 1 ? 'ocorrência' : 'ocorrências'})</span>
                  <span className="font-medium">{formatCurrency(totalDiariasExclusivas)}</span>
                </div>
              )}
              {totalRefeicoes > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span>Refeições ({ocorrenciasRefeicao} {ocorrenciasRefeicao === 1 ? 'ocorrência' : 'ocorrências'})</span>
                  <span className="font-medium">{formatCurrency(totalRefeicoes)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">TOTAL ESTIMADO</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(totalGeral)}
                </span>
              </div>
              <EstimativaAviso variant="compact" />
            </CardContent>
          </Card>

          {DIARIAS_LOTES_UI_PREVIEW && (
            <LotesPreviewPanel
              convocadosPreRaw={solicitacao.convocados_pre}
              periodo={{ inicio: solicitacao.data_inicio, fim: solicitacao.data_fim }}
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 flex justify-between gap-2 sm:justify-between">
          {solicitacao.status === 'enviada' && canAutorizar && onReprovar && (
            <Button 
              variant="destructive" 
              onClick={() => onReprovar(solicitacao)}
              className="mr-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Reprovar
            </Button>
          )}
          
          <div className="flex gap-2 ml-auto flex-wrap">
            {podeSolicitarAditivo && (
              <Button
                variant="outline"
                onClick={() => setAditivoOpen(true)}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Solicitar Aditivo
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            
            {solicitacao.status === 'enviada' && canAutorizar && onAutorizar && (
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onAutorizar(solicitacao)}
              >
                <Check className="h-4 w-4 mr-2" />
                Autorizar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {podeSolicitarAditivo && (
        <AditivoSolicitarModal
          open={aditivoOpen}
          onOpenChange={setAditivoOpen}
          solicitacao={solicitacao}
        />
      )}

      <AditivoConfirmacaoModal
        aditivoId={aditivoAnaliseId}
        open={!!aditivoAnaliseId}
        onOpenChange={(v) => !v && setAditivoAnaliseId(null)}
      />
    </Dialog>
  );
}
