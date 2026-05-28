import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, XCircle, CheckCircle2, Ban, PlayCircle, FileDown } from 'lucide-react';
import {
  Desligamento,
  getStatusDesligamentoColor, getStatusDesligamentoLabel, getTipoDesligamentoLabel,
} from '@/types/desligamento';

interface Props {
  desligamentos: Desligamento[];
  onView: (d: Desligamento) => void;
  onCancel: (d: Desligamento) => void;
  onApprove: (d: Desligamento) => void;
  onReject: (d: Desligamento) => void;
  onEffect: (d: Desligamento) => void;
  onPdf: (d: Desligamento) => void;
  canCancel?: boolean;
  canApprove?: boolean;
  canEffect?: boolean;
}

/**
 * Dias entre admissão e a data efetiva de desligamento (ou data atual como fallback).
 * Comparação normalizada a 12h local para evitar drift de timezone.
 */
const diasAteDesligamento = (
  admissao: string | null | undefined,
  efetiva: string | null | undefined,
  dataFunc: string | null | undefined,
): number | null => {
  if (!admissao) return null;
  const ref = (efetiva || dataFunc || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const a = new Date(admissao.slice(0, 10) + 'T12:00:00');
  const r = new Date(ref + 'T12:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(r.getTime())) return null;
  return Math.floor((r.getTime() - a.getTime()) / 86_400_000);
};

export const DesligamentoList: React.FC<Props> = ({
  desligamentos, onView, onCancel, onApprove, onReject, onEffect, onPdf,
  canCancel = true, canApprove = true, canEffect = true,
}) => {
  const fmtDate = (d: string | null) => !d ? '—' : new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  const fmtDateISO = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('pt-BR');

  return (
    <TooltipProvider>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data Solic.</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Aprovador</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {desligamentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum desligamento registrado
                </TableCell>
              </TableRow>
            ) : (
              desligamentos.map(d => {
                const f = d.bd_funcionarios;
                const isVirtual = !!d.isVirtual;
                const isPendente = d.status === 'pendente_aprovacao';
                const isAprovada = d.status === 'aprovada';
                const isCancelavel = !isVirtual && d.status !== 'cancelado' && d.status !== 'reprovada';
                const dias = diasAteDesligamento(
                  f?.data_admissao,
                  d.data_efetiva_desligamento,
                  (f as any)?.data_desligamento,
                );
                const periodoExperiencia = dias != null && dias < 90;

                return (
                  <TableRow key={d.id}>
                    <TableCell>{fmtDateISO(d.data_solicitacao)}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{f?.nome_completo || '—'}</span>
                        {periodoExperiencia && (
                          <Badge variant="secondary" className="text-[10px]">
                            Sem exame — período de experiência
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{f?.bd_funcoes?.nome_funcao || ''}</div>
                    </TableCell>
                    <TableCell>
                      {f?.bd_centros_custo?.codigo_centro_custo
                        ? `${f.bd_centros_custo.codigo_centro_custo}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getTipoDesligamentoLabel(d.tipo_desligamento)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={getStatusDesligamentoColor(d.status) as any}>
                          {getStatusDesligamentoLabel(d.status)}
                        </Badge>
                        {isVirtual && (
                          <span className="text-[10px] text-muted-foreground">
                            Registro derivado de funcionário inativo
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onView(d)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Visualizar</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onPdf(d)}>
                              <FileDown className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Gerar PDF da Solicitação</TooltipContent>
                        </Tooltip>

                        {!isVirtual && isPendente && canApprove && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => onApprove(d)}>
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Aprovar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => onReject(d)}>
                                  <Ban className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Reprovar</TooltipContent>
                            </Tooltip>
                          </>
                        )}

                        {!isVirtual && isAprovada && canEffect && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => onEffect(d)}>
                                <PlayCircle className="h-4 w-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Efetivar</TooltipContent>
                          </Tooltip>
                        )}

                        {isCancelavel && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon"
                                onClick={() => onCancel(d)} disabled={!canCancel}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancelar</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};
