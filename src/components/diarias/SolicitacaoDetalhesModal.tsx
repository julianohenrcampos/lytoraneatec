import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { toast } from "sonner";
import { analisarPeriodo } from "@/utils/diariasPeriodoUtils";
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
  const queryClient = useQueryClient();
  const sincronizarDiarias = useSincronizarDiarias();
  
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

      // Buscar nome do responsável em campo (apontador)
      let apontadorNome = null;
      if (solicitacao.responsavel_campo_id) {
        const { data: apontador } = await supabase
          .from('bd_funcionarios')
          .select('nome_completo')
          .eq('id', solicitacao.responsavel_campo_id)
          .maybeSingle();
        
        if (apontador) {
          apontadorNome = apontador.nome_completo;
        }
      }

      // Buscar nome do engenheiro solicitante
      let engenheiroSolicitanteNome = null;
      if ((solicitacao as any).engenheiro_solicitante_id) {
        const { data: engenheiro } = await supabase
          .from('bd_funcionarios')
          .select('nome_completo')
          .eq('id', (solicitacao as any).engenheiro_solicitante_id)
          .maybeSingle();
        
        if (engenheiro) {
          engenheiroSolicitanteNome = engenheiro.nome_completo;
        }
      }

      // Buscar nome do criador
      let criadorNome = null;
      if (solicitacao.criado_por) {
        const { data: criador } = await supabase
          .from('profiles')
          .select('nome_completo')
          .eq('id', solicitacao.criado_por)
          .maybeSingle();
        
        if (criador) {
          criadorNome = criador.nome_completo;
        }
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
  // Se período é exclusivamente FDS/feriados, calcular sempre (mesmo se flag salvo como false)
  const periodoExclusivoFDS = diasNormais === 0;
  const deveCalcularExclusivos = consideraFdsEFeriado || periodoExclusivoFDS;
  const mostrarColunaDiariaEspecial = deveCalcularExclusivos && diasExclusivos > 0;

  let totalDiariasNormais = 0;
  let totalDiariasExclusivas = 0;
  let totalRefeicoes = 0;

  convocadosPre.forEach(conv => {
    const valorDiaria = conv.valor_diaria || 0;
    const valorExclusiva = conv.valor_diaria_exclusiva || valorDiaria * 1.2;
    const valorRefeicao = conv.valor_refeicao || 0;
    const forcarExclusiva = conv.usar_diaria_exclusiva === true;
    
    if (forcarExclusiva) {
      const totalDias = deveCalcularExclusivos ? diasNormais + diasExclusivos : diasNormais;
      totalDiariasExclusivas += totalDias * valorExclusiva;
      totalRefeicoes += totalDias * valorRefeicao;
    } else {
      totalDiariasNormais += diasNormais * valorDiaria;
      if (deveCalcularExclusivos) {
        totalDiariasExclusivas += diasExclusivos * valorExclusiva;
      }
      const diasParaRefeicao = deveCalcularExclusivos ? diasNormais + diasExclusivos : diasNormais;
      totalRefeicoes += diasParaRefeicao * valorRefeicao;
    }
  });

  const totalGeral = totalDiariasNormais + totalDiariasExclusivas + totalRefeicoes;
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
        } : undefined
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
                <span>Diárias Úteis + Sáb ({diasNormais} {diasNormais === 1 ? 'dia' : 'dias'}, {convocadosPre.length} func.)</span>
                <span className="font-medium">{formatCurrency(totalDiariasNormais)}</span>
              </div>
              {mostrarColunaDiariaEspecial && (
                <div className="flex justify-between items-center text-sm">
                  <span>Diárias Dom/Feriados ({diasExclusivos} {diasExclusivos === 1 ? 'dia' : 'dias'}, {convocadosPre.length} func.)</span>
                  <span className="font-medium">{formatCurrency(totalDiariasExclusivas)}</span>
                </div>
              )}
              {totalRefeicoes > 0 && (() => {
                const diasParaRefeicao = consideraFdsEFeriado ? diasNormais + diasExclusivos : diasNormais;
                return (
                  <div className="flex justify-between items-center text-sm">
                    <span>Refeições ({diasParaRefeicao} {diasParaRefeicao === 1 ? 'dia' : 'dias'}, {convocadosPre.length} func.)</span>
                    <span className="font-medium">{formatCurrency(totalRefeicoes)}</span>
                  </div>
                );
              })()}
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
          
          <div className="flex gap-2 ml-auto">
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
    </Dialog>
  );
}
