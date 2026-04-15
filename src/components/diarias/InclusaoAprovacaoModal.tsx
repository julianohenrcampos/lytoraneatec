import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Loader2, User, MapPin, Calendar } from "lucide-react";
import { WhatsAppButton } from "./WhatsAppButton";
import { useAprovarInclusao, useRecusarInclusao } from "@/hooks/diarias/useInclusaoFuncionario";

interface InclusaoAprovacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  inclusao: {
    id: string;
    funcionario_nome: string;
    funcionario_cpf?: string;
    centro_custo_nome: string;
    centro_custo_codigo: string;
    solicitante_nome?: string;
    solicitante_telefone?: string;
    data_solicitacao: string;
    justificativa?: string;
    solicitacao_numero?: string;
  } | null;
  onAprovado?: () => void;
}

export function InclusaoAprovacaoModal({
  isOpen,
  onClose,
  inclusao,
  onAprovado
}: InclusaoAprovacaoModalProps) {
  const [justificativaRecusa, setJustificativaRecusa] = useState('');
  const [showRecusaForm, setShowRecusaForm] = useState(false);

  const aprovarMutation = useAprovarInclusao();
  const recusarMutation = useRecusarInclusao();

  if (!inclusao) return null;

  const handleAprovar = async () => {
    await aprovarMutation.mutateAsync(inclusao.id);
    onAprovado?.();
    onClose();
  };

  const handleRecusar = async () => {
    await recusarMutation.mutateAsync({
      id: inclusao.id,
      justificativa: justificativaRecusa
    });
    setShowRecusaForm(false);
    setJustificativaRecusa('');
    onClose();
  };

  const isLoading = aprovarMutation.isPending || recusarMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Aprovação de Inclusão
          </DialogTitle>
          <DialogDescription>
            Solicitação de inclusão de funcionário em diária
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Funcionário</p>
                  <p className="font-medium">{inclusao.funcionario_nome}</p>
                  {inclusao.funcionario_cpf && (
                    <p className="text-xs text-muted-foreground">CPF: {inclusao.funcionario_cpf}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Centro de Custo</p>
                  <p className="font-medium">{inclusao.centro_custo_codigo} - {inclusao.centro_custo_nome}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Solicitação</p>
                  <p className="font-medium">
                    {inclusao.solicitacao_numero || 'N/A'} — {new Date(inclusao.data_solicitacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {inclusao.solicitante_nome && (
                <div>
                  <p className="text-sm text-muted-foreground">Solicitado por</p>
                  <p className="font-medium">{inclusao.solicitante_nome}</p>
                </div>
              )}

              {inclusao.justificativa && (
                <div>
                  <p className="text-sm text-muted-foreground">Justificativa</p>
                  <p className="text-sm">{inclusao.justificativa}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  Pendente
                </Badge>
              </div>
            </CardContent>
          </Card>

          {showRecusaForm && (
            <div className="space-y-2">
              <Label>Motivo da recusa</Label>
              <Textarea
                value={justificativaRecusa}
                onChange={(e) => setJustificativaRecusa(e.target.value)}
                placeholder="Informe o motivo da recusa..."
                className="min-h-[80px]"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {inclusao.solicitante_telefone && (
            <WhatsAppButton
              telefone={inclusao.solicitante_telefone}
              mensagem={`Sobre a diária do funcionário ${inclusao.funcionario_nome}`}
              className="w-full sm:w-auto"
            />
          )}

          {showRecusaForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRecusaForm(false)}
                disabled={isLoading}
                className="h-12 sm:h-10"
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRecusar}
                disabled={isLoading}
                className="h-12 sm:h-10"
              >
                {recusarMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recusando...</>
                ) : (
                  <><X className="mr-2 h-4 w-4" />Confirmar Recusa</>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={() => setShowRecusaForm(true)}
                disabled={isLoading}
                className="h-12 sm:h-10"
              >
                <X className="mr-2 h-4 w-4" />
                Recusar
              </Button>
              <Button
                onClick={handleAprovar}
                disabled={isLoading}
                className="h-12 sm:h-10"
              >
                {aprovarMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aprovando...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" />Aprovar</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
