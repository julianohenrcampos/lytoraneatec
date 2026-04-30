import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFuncionarioSearch } from '@/hooks/ssoAgendamentoExames/useFuncionarioSearch';
import { FuncionarioSelecionado, TipoExame } from '@/types/ssoAgendamentoExames';
import { Search, Loader2, User, Building2, Briefcase, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEscopoCentrosCusto } from '@/hooks/useEscopoCentrosCusto';

interface FuncionarioSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoExame: TipoExame;
  onSelect: (funcionario: FuncionarioSelecionado) => void;
}

const getTipoExameLabel = (tipo: TipoExame): string => {
  switch (tipo) {
    case 'Retorno ao Trabalho':
      return 'Retorno ao Trabalho';
    case 'Demissional':
      return 'Demissional';
    case 'Periódico':
      return 'Periódico';
    default:
      return tipo;
  }
};

export const FuncionarioSelectorDialog: React.FC<FuncionarioSelectorDialogProps> = ({
  open,
  onOpenChange,
  tipoExame,
  onSelect
}) => {
  const statusFilter = tipoExame === 'Retorno ao Trabalho' ? 'INSS' : undefined;
  const { funcionarios, isLoading, error, refetch, searchTerm, setSearchTerm, hasSearchTerm, resultLimit } = useFuncionarioSearch(statusFilter, open);
  const { isGlobal, allowedCentroIds } = useEscopoCentrosCusto();
  const [selectedFuncionario, setSelectedFuncionario] = useState<FuncionarioSelecionado | null>(null);
  const [enriching, setEnriching] = useState(false);

  const handleContinue = async () => {
    if (!selectedFuncionario) return;

    // BARREIRA PRINCIPAL DE ESCOPO — não confia no filtro visual.
    // Bloqueia mesmo se o item vier de cache, manipulação de estado ou bug de UI.
    if (!isGlobal) {
      const ccId = selectedFuncionario.centro_custo_id ?? '';
      if (!ccId || !allowedCentroIds.includes(ccId)) {
        toast.error('Este funcionário está fora do seu escopo de centros de custo.');
        return;
      }
    }

    setEnriching(true);
    try {
      // Enriquecimento por id — sem embed FK, selects simples
      const { data: extra, error: extraErr } = await supabase
        .from('bd_funcionarios')
        .select(`
          id, email, data_nascimento, data_admissao,
          agencia, conta_corrente,
          endereco_rua, endereco_numero, endereco_bairro,
          endereco_cidade, endereco_estado, endereco_cep,
          empresa_id, centro_custo_id
        `)
        .eq('id', selectedFuncionario.id)
        .maybeSingle();

      if (extraErr) throw extraErr;
      if (!extra) {
        toast.error('Não foi possível carregar os dados do funcionário (acesso restrito).');
        setEnriching(false);
        return;
      }

      const [empresaRes, ccRes] = await Promise.all([
        extra.empresa_id
          ? supabase.from('bd_empresas').select('nome_empresa').eq('id', extra.empresa_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        extra.centro_custo_id
          ? supabase.from('bd_centros_custo').select('nome_centro_custo').eq('id', extra.centro_custo_id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      const merged: FuncionarioSelecionado = {
        ...selectedFuncionario,
        email: extra.email ?? selectedFuncionario.email,
        data_nascimento: extra.data_nascimento ?? null,
        data_admissao: extra.data_admissao ?? null,
        banco_agencia: extra.agencia ?? null,
        banco_conta: extra.conta_corrente ?? null,
        endereco_rua: extra.endereco_rua ?? null,
        endereco_numero: extra.endereco_numero ?? null,
        endereco_bairro: extra.endereco_bairro ?? null,
        endereco_cidade: extra.endereco_cidade ?? null,
        endereco_estado: extra.endereco_estado ?? null,
        endereco_cep: extra.endereco_cep ?? null,
        empresa: (empresaRes?.data as any)?.nome_empresa || selectedFuncionario.empresa || '',
        centro_custo: (ccRes?.data as any)?.nome_centro_custo || null,
        centro_custo_id: extra.centro_custo_id ?? selectedFuncionario.centro_custo_id ?? null,
      };

      onSelect(merged);
      setSelectedFuncionario(null);
      setSearchTerm('');
    } catch (e: any) {
      console.error('[FuncionarioSelectorDialog] Erro ao enriquecer dados:', e);
      toast.error('Erro ao carregar dados do funcionário. Tente novamente.');
    } finally {
      setEnriching(false);
    }
  };

  const handleClose = () => {
    setSelectedFuncionario(null);
    setSearchTerm('');
    onOpenChange(false);
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const renderContent = () => {
    // Estado 1: Carregando
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando funcionários...</p>
        </div>
      );
    }

    // Estado 2: Erro
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-32 gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">Erro ao buscar funcionários</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    // Estado 3: Sem resultados
    if (funcionarios.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground px-4 text-center">
          <User className="h-8 w-8 mb-2" />
          <p className="text-sm">
            {hasSearchTerm
              ? 'Nenhum funcionário encontrado com esse nome ou CPF'
              : 'Digite o nome ou CPF do funcionário para buscar'}
          </p>
        </div>
      );
    }

    // Estado 4: Lista carregada
    return (
      <div className="p-2 space-y-1">
        {funcionarios.length >= resultLimit && (
          <p className="text-xs text-muted-foreground px-2 py-1">
            Mostrando os primeiros {resultLimit} resultados. Refine a busca para encontrar mais.
          </p>
        )}
        {funcionarios.map((func) => (
          <div
            key={func.id}
            onClick={() => setSelectedFuncionario(func)}
            className={cn(
              "p-3 rounded-lg cursor-pointer transition-colors border",
              selectedFuncionario?.id === func.id
                ? "bg-primary/10 border-primary"
                : "bg-background hover:bg-muted border-transparent"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{func.nome_completo}</span>
                  {selectedFuncionario?.id === func.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {func.funcao || 'Sem função'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {func.empresa || 'Sem empresa'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  CPF: {formatCPF(func.cpf)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Selecionar Funcionário para Exame {getTipoExameLabel(tipoExame)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o nome do funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[350px] border rounded-lg">
            {renderContent()}
          </ScrollArea>

          {selectedFuncionario && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm font-medium">Selecionado:</p>
              <p className="text-sm">
                {selectedFuncionario.nome_completo} - {selectedFuncionario.funcao}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleContinue} 
            disabled={!selectedFuncionario || enriching}
          >
            {enriching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
