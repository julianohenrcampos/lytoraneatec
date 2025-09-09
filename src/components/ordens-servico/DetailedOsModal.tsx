import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { FileText, Truck, User, Clock, Wrench, Package, Users, DollarSign, Calendar, MapPin, Phone, Settings, CheckCircle, AlertCircle, Timer, History, Building } from "lucide-react";
import { OrdemServico, Material, MaoDeObra, Movimentacao } from "@/types/ordemServico";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
interface DetailedOsModalProps {
  isOpen: boolean;
  onClose: () => void;
  os: OrdemServico | null;
  materials: Material[];
  laborItems: MaoDeObra[];
  movements: Movimentacao[];
  isLoading: boolean;
  onGeneratePdf?: (osId: string) => void;
}
const DetailedOsModal: React.FC<DetailedOsModalProps> = ({
  isOpen,
  onClose,
  os,
  materials,
  laborItems,
  movements,
  isLoading,
  onGeneratePdf
}) => {
  if (!os) return null;
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Aberta': {
        variant: 'default' as const,
        className: 'bg-blue-100 text-blue-800'
      },
      'Em Andamento': {
        variant: 'secondary' as const,
        className: 'bg-yellow-100 text-yellow-800'
      },
      'Concluída': {
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800'
      },
      'Cancelada': {
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800'
      }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['Aberta'];
    return <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>;
  };
  const calculateTotals = () => {
    const totalMaterials = materials.reduce((sum, item) => sum + (item.valor_total || 0), 0);
    const totalLabor = laborItems.reduce((sum, item) => sum + (item.valor_total || 0), 0);
    const serviceValue = os.valor_servico || 0;
    const totalGeneral = totalMaterials + totalLabor + serviceValue;
    return {
      totalMaterials,
      totalLabor,
      serviceValue,
      totalGeneral
    };
  };
  const {
    totalMaterials,
    totalLabor,
    serviceValue,
    totalGeneral
  } = calculateTotals();
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };
  if (isLoading) {
    return <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando detalhes...</span>
          </div>
        </DialogContent>
      </Dialog>;
  }
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Ordem de Serviço Nº {os.numero_os}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(os.status)}
                  {os.terceirizada && <Badge variant="outline" className="bg-purple-50 text-purple-700">
                      Terceirizada
                    </Badge>}
                  {os.tipo_manutencao && <Badge variant="outline" className="bg-orange-50 text-orange-700">
                      {os.tipo_manutencao}
                    </Badge>}
                </div>
              </div>
            </div>
            {onGeneratePdf && <Button onClick={() => onGeneratePdf(os.id)} variant="outline" size="sm" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Gerar PDF
              </Button>}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* CABEÇALHO - INFORMAÇÕES PRINCIPAIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Data de Abertura
              </div>
              <div className="font-medium">
                {formatBrazilianDateForDisplay(os.data_abertura)}
              </div>
            </div>
            
            

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                Duração Total
              </div>
              <div className="font-medium">
                {os.duracao_total || 'N/A'}
              </div>
            </div>
          </div>

          {/* SEÇÃO 1: INFORMAÇÕES GERAIS */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Informações Gerais</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna 1 */}
              <div className="space-y-4">
                {/* Equipamento */}
                {os.caminhao_equipamento && <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Truck className="h-4 w-4" />
                      Equipamento/Veículo
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {os.caminhao_equipamento.placa} - {os.caminhao_equipamento.tipo_veiculo}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {os.caminhao_equipamento.marca} {os.caminhao_equipamento.modelo}
                      </div>
                    </div>
                  </div>}

                {/* Solicitante */}
                {os.solicitante && <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4" />
                      Solicitante
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium">
                        {os.solicitante.nome_completo || os.solicitante.email}
                      </div>
                      {os.telefone_solicitante && <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {os.telefone_solicitante}
                        </div>}
                    </div>
                  </div>}

                {/* Centro de Custo */}
                {os.centro_custo && <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Building className="h-4 w-4" />
                      Centro de Custo
                    </div>
                    <div className="font-medium">
                      {os.centro_custo.codigo_centro_custo} - {os.centro_custo.nome_centro_custo}
                    </div>
                  </div>}
              </div>

              {/* Coluna 2 */}
              <div className="space-y-4">
                {/* Obra/Pátio */}
                {os.obra_patio && <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      Obra/Pátio
                    </div>
                    <div className="font-medium">{os.obra_patio}</div>
                  </div>}

                {/* Setor Executante */}
                {os.setor_executante && <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Settings className="h-4 w-4" />
                      Setor Executante
                    </div>
                    <div className="font-medium">{os.setor_executante}</div>
                  </div>}

                {/* Hodômetro/Horímeto */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Timer className="h-4 w-4" />
                    Hodômetro/Horímetro
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Inicial:</span> {os.horimetro_odometro_inicial || 'N/A'}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Final:</span> {os.horimetro_odometro_final || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* SEÇÃO 2: SERVIÇO SOLICITADO */}
          {os.descricao_servico && <>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold border-b pb-2">Serviço Solicitado</h3>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm leading-relaxed">{os.descricao_servico}</p>
                </div>
              </div>
              <Separator />
            </>}

          {/* SEÇÃO 3: TRATATIVA/SOLUÇÃO EXECUTADA */}
          {os.tratativa_solucao && <>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold border-b pb-2">Tratativa/Solução Executada</h3>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm leading-relaxed">{os.tratativa_solucao}</p>
                </div>
              </div>
              <Separator />
            </>}

          {/* SEÇÃO 4: MATERIAIS E PEÇAS */}
          {materials.length > 0 && <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Materiais e Peças Utilizadas</h3>
                </div>
                
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px]">Item</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Valor Unit.</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material, index) => <TableRow key={material.id}>
                          <TableCell className="font-medium text-center">
                            {String(index + 1).padStart(2, '0')}
                          </TableCell>
                          <TableCell>{material.descricao_material}</TableCell>
                          <TableCell className="text-center">{material.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(material.valor_unitario)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(material.valor_total)}</TableCell>
                        </TableRow>)}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={4} className="text-right">Total de Materiais:</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalMaterials)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Separator />
            </>}

          {/* SEÇÃO 5: MÃO DE OBRA */}
          {laborItems.length > 0 && <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Mão de Obra</h3>
                </div>
                
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px]">Item</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-center">Qtd Horas</TableHead>
                        <TableHead className="text-right">Valor/Hora</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {laborItems.map((labor, index) => <TableRow key={labor.id}>
                          <TableCell className="font-medium text-center">
                            {String(index + 1).padStart(2, '0')}
                          </TableCell>
                          <TableCell>{labor.funcao}</TableCell>
                          <TableCell className="text-center">{labor.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(labor.valor_unitario)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(labor.valor_total)}</TableCell>
                        </TableRow>)}
                      <TableRow className="bg-muted/30 font-medium">
                        <TableCell colSpan={4} className="text-right">Total de Mão de Obra:</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalLabor)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Separator />
            </>}

          {/* SEÇÃO 6: RESUMO FINANCEIRO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Resumo Financeiro</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Valor do Serviço:</span>
                  <span className="font-medium">{formatCurrency(serviceValue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total de Materiais:</span>
                  <span className="font-medium">{formatCurrency(totalMaterials)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total de Mão de Obra:</span>
                  <span className="font-medium">{formatCurrency(totalLabor)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>VALOR TOTAL DA OS:</span>
                  <span className="text-primary">{formatCurrency(totalGeneral)}</span>
                </div>
              </div>

              {/* Pessoas Envolvidas */}
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium">Pessoas Envolvidas</h4>
                <div className="space-y-2 text-sm">
                  {os.executado_por && <div>
                      <span className="text-muted-foreground">Executado por:</span>
                      <div className="font-medium">{os.executado_por.nome_completo || os.executado_por.email}</div>
                    </div>}
                  {os.encerrado_por && <div>
                      <span className="text-muted-foreground">Encerrado por:</span>
                      <div className="font-medium">{os.encerrado_por.nome_completo || os.encerrado_por.email}</div>
                    </div>}
                  {os.data_inicio_atendimento && <div>
                      <span className="text-muted-foreground">Início do atendimento:</span>
                      <div className="font-medium">
                        {formatBrazilianDateForDisplay(os.data_inicio_atendimento)}
                        {os.hora_inicio_atendimento && ` às ${formatTime(os.hora_inicio_atendimento)}`}
                      </div>
                    </div>}
                  {os.data_encerramento_atendimento && <div>
                      <span className="text-muted-foreground">Encerramento:</span>
                      <div className="font-medium">
                        {formatBrazilianDateForDisplay(os.data_encerramento_atendimento)}
                        {os.hora_encerramento_atendimento && ` às ${formatTime(os.hora_encerramento_atendimento)}`}
                      </div>
                    </div>}
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 7: HISTÓRICO DE MOVIMENTAÇÕES */}
          {movements.length > 0 && <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Histórico de Movimentações</h3>
                </div>
                
                <div className="space-y-2">
                  {movements.map(movement => <div key={movement.id} className="flex gap-4 p-3 border border-border rounded-lg bg-muted/20">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatBrazilianDateForDisplay(movement.data_movimentacao)} às {formatTime(movement.hora_movimentacao)}
                        </div>
                        <div className="font-medium mt-1">{movement.motivo}</div>
                        {movement.usuario && <div className="text-sm text-muted-foreground mt-1">
                            por {movement.usuario.nome_completo || movement.usuario.email}
                          </div>}
                      </div>
                    </div>)}
                </div>
              </div>
            </>}

          {/* Observações */}
          {os.observacoes && <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Observações</h3>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm leading-relaxed">{os.observacoes}</p>
                </div>
              </div>
            </>}
        </div>
      </DialogContent>
    </Dialog>;
};
export default DetailedOsModal;