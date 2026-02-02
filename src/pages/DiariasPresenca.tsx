import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Check, 
  X, 
  User, 
  Clock,
  Building2,
  Filter,
  Loader2,
  Calendar as CalendarIcon
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { 
  useConvocadosParaPresenca,
  useConfirmarPresenca
} from "@/hooks/diarias";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StatusPresenca, DiariaConvocado } from "@/types/diarias";

export default function DiariasPresenca() {
  const { permissions, userId, isSuperAdmin, isLoading: isLoadingPermissions } = useDynamicPermissions();
  const hasPermission = (perm: string) => permissions.includes(perm);
  
  // Verificar permissão de acesso
  const hasAccess = isSuperAdmin || hasPermission('diarias_view');
  
  // Filters
  const [dataFiltro, setDataFiltro] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [centroCustoFiltro, setCentroCustoFiltro] = useState<string>('');
  
  // Dialog state
  const [isPresencaOpen, setIsPresencaOpen] = useState(false);
  const [selectedConvocado, setSelectedConvocado] = useState<DiariaConvocado | null>(null);
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSaida, setHoraSaida] = useState('');
  const [intervaloInicio, setIntervaloInicio] = useState('');
  const [intervaloFim, setIntervaloFim] = useState('');

  // Queries - DEVE VIR ANTES DOS EARLY RETURNS
  const { data: convocados = [], isLoading } = useConvocadosParaPresenca(
    dataFiltro || undefined,
    centroCustoFiltro || undefined
  );
  
  // Centro de custos
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .order('nome_centro_custo');
      return data || [];
    }
  });

  // Mutations
  const confirmarMutation = useConfirmarPresenca();

  // Permissions
  const canConfirmar = isSuperAdmin || hasPermission('diarias_confirmar_presenca');
  
  // Loading de permissões - APÓS TODOS OS HOOKS
  if (isLoadingPermissions) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando...</span>
        </div>
      </MainLayout>
    );
  }
  
  // Sem permissão - APÓS TODOS OS HOOKS
  if (!hasAccess) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <p className="text-xs text-muted-foreground mt-1">Permissão necessária: diarias_view</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Check segregation - não pode confirmar se criou a convocação
  const canUserConfirmar = (convocado: any) => {
    const criadoPor = convocado.bd_diaria_convocacoes?.criado_por;
    return canConfirmar && criadoPor !== userId;
  };

  // Handlers
  const handleOpenPresenca = (convocado: DiariaConvocado) => {
    setSelectedConvocado(convocado);
    setHoraEntrada(convocado.hora_entrada || format(new Date(), 'HH:mm'));
    setHoraSaida(convocado.hora_saida || '');
    setIntervaloInicio(convocado.intervalo_inicio || '');
    setIntervaloFim(convocado.intervalo_fim || '');
    setIsPresencaOpen(true);
  };

  const handleConfirmarPresente = async () => {
    if (!selectedConvocado) return;
    
    await confirmarMutation.mutateAsync({
      id: selectedConvocado.id,
      status: 'presente',
      horarios: {
        hora_entrada: horaEntrada || undefined,
        hora_saida: horaSaida || undefined,
        intervalo_inicio: intervaloInicio || undefined,
        intervalo_fim: intervaloFim || undefined
      }
    });
    setIsPresencaOpen(false);
  };

  const handleMarcarAusente = async (convocado: DiariaConvocado) => {
    await confirmarMutation.mutateAsync({
      id: convocado.id,
      status: 'ausente'
    });
  };

  // Agrupar por convocação/centro de custo
  const convocadosAgrupados = convocados.reduce((acc: any, conv: any) => {
    const key = conv.bd_diaria_convocacoes?.id || 'sem-convocacao';
    if (!acc[key]) {
      acc[key] = {
        convocacao: conv.bd_diaria_convocacoes,
        convocados: []
      };
    }
    acc[key].convocados.push(conv);
    return acc;
  }, {});

  // Stats
  const totalConvocados = convocados.length;
  const presentes = convocados.filter((c: any) => c.presenca_status === 'presente').length;
  const ausentes = convocados.filter((c: any) => c.presenca_status === 'ausente').length;
  const pendentes = convocados.filter((c: any) => c.presenca_status === 'pendente').length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Presença em Campo</h1>
          <p className="text-muted-foreground">
            Confirme a presença dos funcionários convocados para diária
          </p>
        </div>

        {/* Filters - Mobile friendly */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={dataFiltro}
                  onChange={(e) => setDataFiltro(e.target.value)}
                />
              </div>
              <div>
                <Label>Centro de Custo</Label>
                <Select
                  value={centroCustoFiltro || '__all__'}
                  onValueChange={(v) => setCentroCustoFiltro(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {centrosCusto.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo_centro_custo} - {cc.nome_centro_custo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards - Mobile */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalConvocados}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{presentes}</div>
                <div className="text-xs text-muted-foreground">Presentes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{ausentes}</div>
                <div className="text-xs text-muted-foreground">Ausentes</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{pendentes}</div>
                <div className="text-xs text-muted-foreground">Pendentes</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Convocados - Cards Mobile First */}
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : convocados.length === 0 ? (
          <Card>
            <CardContent className="text-center p-8 text-muted-foreground">
              Nenhum funcionário convocado para esta data/centro de custo.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.values(convocadosAgrupados).map((grupo: any, idx) => (
              <div key={idx} className="space-y-3">
                {/* Header do grupo */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{grupo.convocacao?.bd_centros_custo?.nome_centro_custo || 'Centro de Custo'}</span>
                  <CalendarIcon className="h-4 w-4 ml-2" />
                  <span>{grupo.convocacao?.data ? format(new Date(grupo.convocacao.data), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</span>
                </div>

                {/* Cards dos convocados */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grupo.convocados.map((convocado: any) => {
                    const canConfirmarThis = canUserConfirmar(convocado);
                    const isPendente = convocado.presenca_status === 'pendente';
                    const isPresente = convocado.presenca_status === 'presente';
                    const isAusente = convocado.presenca_status === 'ausente';

                    return (
                      <Card key={convocado.id} className={`
                        ${isPresente ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}
                        ${isAusente ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}
                      `}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={convocado.bd_funcionarios?.imagem || undefined} />
                              <AvatarFallback>
                                <User className="h-6 w-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {convocado.bd_funcionarios?.nome_completo}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {convocado.bd_funcoes?.nome_funcao}
                              </div>
                              <div className="text-sm font-medium text-primary mt-1">
                                R$ {convocado.valor_diaria_aplicada.toFixed(2)}
                              </div>
                            </div>
                            <Badge variant={
                              isPresente ? 'default' :
                              isAusente ? 'destructive' : 'secondary'
                            }>
                              {isPresente ? 'Presente' :
                               isAusente ? 'Ausente' : 'Pendente'}
                            </Badge>
                          </div>

                          {/* Horários se presente */}
                          {isPresente && convocado.hora_entrada && (
                            <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {convocado.hora_entrada}
                                {convocado.hora_saida && ` - ${convocado.hora_saida}`}
                              </div>
                            </div>
                          )}

                          {/* Botões de ação - grandes para mobile */}
                          {isPendente && canConfirmarThis && (
                            <div className="mt-4 flex gap-2">
                              <Button 
                                className="flex-1 h-12"
                                onClick={() => handleOpenPresenca(convocado)}
                              >
                                <Check className="h-5 w-5 mr-2" />
                                Presente
                              </Button>
                              <Button 
                                variant="destructive"
                                className="flex-1 h-12"
                                onClick={() => handleMarcarAusente(convocado)}
                                disabled={confirmarMutation.isPending}
                              >
                                <X className="h-5 w-5 mr-2" />
                                Ausente
                              </Button>
                            </div>
                          )}

                          {!canConfirmarThis && isPendente && (
                            <div className="mt-4 text-xs text-muted-foreground text-center">
                              Você não pode confirmar presença para esta convocação.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog Presença */}
        <Dialog open={isPresencaOpen} onOpenChange={setIsPresencaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Presença</DialogTitle>
              <DialogDescription>
                Registre os horários de entrada e saída do funcionário.
              </DialogDescription>
            </DialogHeader>
            
            {selectedConvocado && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Avatar>
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{selectedConvocado.bd_funcionarios?.nome_completo}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedConvocado.bd_funcoes?.nome_funcao} - R$ {selectedConvocado.valor_diaria_aplicada.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Hora de Entrada</Label>
                    <Input
                      type="time"
                      value={horaEntrada}
                      onChange={(e) => setHoraEntrada(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Hora de Saída</Label>
                    <Input
                      type="time"
                      value={horaSaida}
                      onChange={(e) => setHoraSaida(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Início Intervalo</Label>
                    <Input
                      type="time"
                      value={intervaloInicio}
                      onChange={(e) => setIntervaloInicio(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Fim Intervalo</Label>
                    <Input
                      type="time"
                      value={intervaloFim}
                      onChange={(e) => setIntervaloFim(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPresencaOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmarPresente}
                disabled={confirmarMutation.isPending}
              >
                {confirmarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar Presença
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
