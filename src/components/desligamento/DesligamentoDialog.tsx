import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, User, AlertTriangle, RefreshCw } from 'lucide-react';
import { useFuncionarioSearch } from '@/hooks/ssoAgendamentoExames/useFuncionarioSearch';
import { DesligamentoFormData, MOTIVOS_DESLIGAMENTO } from '@/types/desligamento';
import { FuncionarioSelecionado } from '@/types/ssoAgendamentoExames';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: DesligamentoFormData) => void;
  isSubmitting: boolean;
}

export const DesligamentoDialog: React.FC<Props> = ({ open, onOpenChange, onSubmit, isSubmitting }) => {
  const { funcionarios, isLoading: loadingFunc, error: errorFunc, refetch, searchTerm: search, setSearchTerm: setSearch } = useFuncionarioSearch();
  const [selectedFunc, setSelectedFunc] = useState<FuncionarioSelecionado | null>(null);
  const [tipoDesligamento, setTipoDesligamento] = useState<'com_aviso' | 'sem_aviso'>('sem_aviso');
  const [diasAviso, setDiasAviso] = useState(30);
  const [motivo, setMotivo] = useState('');
  const [recontratavel, setRecontratavel] = useState(true);
  const [observacoes, setObservacoes] = useState('');

  const dataFimAviso = useMemo(() => {
    if (tipoDesligamento !== 'com_aviso') return null;
    const d = new Date();
    d.setDate(d.getDate() + diasAviso);
    return d.toLocaleDateString('pt-BR');
  }, [tipoDesligamento, diasAviso]);

  const handleSubmit = () => {
    if (!selectedFunc) return;
    onSubmit({
      funcionario_id: selectedFunc.id,
      tipo_desligamento: tipoDesligamento,
      dias_aviso: diasAviso,
      motivo,
      recontratavel,
      observacoes,
    });
  };

  const handleClose = () => {
    setSelectedFunc(null);
    setSearch('');
    setTipoDesligamento('sem_aviso');
    setDiasAviso(30);
    setMotivo('');
    setRecontratavel(true);
    setObservacoes('');
    onOpenChange(false);
  };

  // Auto-set recontratavel based on motivo
  React.useEffect(() => {
    if (motivo === 'Dispensa com justa causa') {
      setRecontratavel(false);
    }
  }, [motivo]);

  const renderFuncionarioList = () => {
    if (loadingFunc) {
      return (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando funcionários...</p>
        </div>
      );
    }

    if (errorFunc) {
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

    if (funcionarios.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <User className="h-8 w-8 mb-2" />
          <p className="text-sm">
            {search ? 'Nenhum funcionário ativo encontrado com esse nome' : 'Nenhum funcionário ativo disponível'}
          </p>
        </div>
      );
    }

    return (
      <div className="p-2 space-y-1">
        {funcionarios.map(f => (
          <div key={f.id} onClick={() => setSelectedFunc(f)}
            className="p-3 rounded-lg cursor-pointer border bg-background hover:bg-muted transition-colors">
            <p className="font-medium">{f.nome_completo}</p>
            <p className="text-sm text-muted-foreground">
              {f.funcao || 'Sem função'} · {f.empresa || 'Sem empresa'} · CPF: {f.cpf}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Desligamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedFunc ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar funcionário pelo nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
              </div>
              <ScrollArea className="h-[300px] border rounded-lg">
                {renderFuncionarioList()}
              </ScrollArea>
            </>
          ) : (
            <>
              {/* Funcionário selecionado */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedFunc.nome_completo}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFunc.funcao} · CPF: {selectedFunc.cpf}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFunc(null)}>Trocar</Button>
              </div>

              {/* Tipo de desligamento */}
              <div className="space-y-2">
                <Label>Tipo de Desligamento</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tipoDesligamento === 'sem_aviso' ? 'default' : 'outline'}
                    onClick={() => setTipoDesligamento('sem_aviso')}
                    className="flex-1"
                  >
                    Sem Aviso Prévio
                  </Button>
                  <Button
                    type="button"
                    variant={tipoDesligamento === 'com_aviso' ? 'default' : 'outline'}
                    onClick={() => setTipoDesligamento('com_aviso')}
                    className="flex-1"
                  >
                    Com Aviso Prévio
                  </Button>
                </div>
              </div>

              {/* Dias de aviso */}
              {tipoDesligamento === 'com_aviso' && (
                <div className="space-y-2">
                  <Label>Dias de Aviso Prévio</Label>
                  <Input type="number" min={1} max={90} value={diasAviso} onChange={e => setDiasAviso(Number(e.target.value))} />
                  {dataFimAviso && (
                    <p className="text-sm text-muted-foreground">
                      📅 Data final prevista: <strong>{dataFimAviso}</strong>
                    </p>
                  )}
                </div>
              )}

              {tipoDesligamento === 'sem_aviso' && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">O funcionário será inativado imediatamente.</p>
                </div>
              )}

              {/* Motivo */}
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DESLIGAMENTO.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recontratável */}
              <div className="flex items-center justify-between">
                <Label>Recontratável?</Label>
                <Switch checked={recontratavel} onCheckedChange={setRecontratavel} />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações adicionais..." rows={3} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!selectedFunc || isSubmitting || !motivo}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar Desligamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
