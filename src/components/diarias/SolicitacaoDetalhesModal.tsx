import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  X
} from "lucide-react";

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
import { EstimativaAviso } from "./EstimativaAviso";

import { supabase } from "@/integrations/supabase/client";
import type { DiariaSolicitacao, FuncionarioPreConvocado } from "@/types/diarias";

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
      const convocadosRaw: FuncionarioPreConvocado[] = Array.isArray(solicitacao.convocados_pre) 
        ? solicitacao.convocados_pre 
        : [];
      
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
        funcionariosMap,
        funcoesMap
      };
    },
    enabled: isOpen && !!solicitacao,
    staleTime: 30000
  });

  if (!solicitacao) return null;

  // Parse convocados_pre (é armazenado como JSON)
  const convocadosPre: FuncionarioPreConvocado[] = Array.isArray(solicitacao.convocados_pre) 
    ? solicitacao.convocados_pre 
    : [];

  // Cálculos de simulação
  const diasUteis = solicitacao.qtde_dias_uteis_estimado || 0;
  const diasFds = solicitacao.qtde_fds_estimado || 0;
  const diasFeriados = solicitacao.qtde_feriados_estimado || 0;
  const diasEspeciais = diasFds + diasFeriados;
  const consideraFdsEFeriado = solicitacao.considera_fds_feriado;

  // Calcular totais por tipo de dia
  let totalDiasUteis = 0;
  let totalDiasEspeciais = 0;

  convocadosPre.forEach(conv => {
    totalDiasUteis += (conv.valor_diaria || 0) * diasUteis;
    if (consideraFdsEFeriado) {
      totalDiasEspeciais += (conv.valor_diaria_exclusiva || conv.valor_diaria || 0) * diasEspeciais;
    }
  });

  const totalGeral = totalDiasUteis + totalDiasEspeciais;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes da Solicitação
          </DialogTitle>
          <DialogDescription>
            Visualize todas as informações da solicitação antes de tomar uma decisão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações Gerais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Período */}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Período
                  </p>
                  <p className="font-medium">
                    {format(new Date(solicitacao.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                    {solicitacao.data_fim !== solicitacao.data_inicio && (
                      <> → {format(new Date(solicitacao.data_fim), "dd/MM/yyyy", { locale: ptBR })}</>
                    )}
                  </p>
                </div>

                {/* Centro de Custo */}
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

              {/* Contagem de dias */}
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span className="text-xs">Dias Úteis</span>
                  </div>
                  <p className="text-lg font-bold">{diasUteis}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarCheck className="h-3 w-3" />
                    <span className="text-xs">FDS</span>
                  </div>
                  <p className="text-lg font-bold">{diasFds}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground">
                    <CalendarX className="h-3 w-3" />
                    <span className="text-xs">Feriados</span>
                  </div>
                  <p className="text-lg font-bold">{diasFeriados}</p>
                </div>
              </div>

              <Separator />

              {/* Pessoas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Solicitante
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.criadorNome || solicitacao.profiles?.nome_completo || "-"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Aprovador do CC
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.aprovadorNome || "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Responsável em Campo
                  </p>
                  <p className="font-medium">
                    {dadosComplementares?.apontadorNome || solicitacao.responsavel_campo?.nome_completo || "-"}
                  </p>
                </div>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-right">Diária Útil</TableHead>
                      <TableHead className="text-right">Diária FDS/Fer</TableHead>
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
                        <TableCell className="text-right">
                          {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Simulação de Valores */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor Total Estimado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span>Dias úteis ({diasUteis} dias × {convocadosPre.length} func.)</span>
                <span className="font-medium">{formatCurrency(totalDiasUteis)}</span>
              </div>
              {consideraFdsEFeriado && diasEspeciais > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span>FDS/Feriados ({diasEspeciais} dias × {convocadosPre.length} func.)</span>
                  <span className="font-medium">{formatCurrency(totalDiasEspeciais)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">TOTAL ESTIMADO</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(solicitacao.valor_estimado_total || totalGeral)}
                </span>
              </div>
              <EstimativaAviso variant="compact" />
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          {/* Botão Reprovar (esquerda) */}
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
            
            {/* Botão Autorizar (direita) */}
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
