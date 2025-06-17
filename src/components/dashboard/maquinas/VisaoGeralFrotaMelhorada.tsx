
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { 
  TipoVeiculoDistribution, 
  StatusOperacionalData, 
  IdadeFrotaData 
} from "@/types/maquinas";
import { ChevronDown, ChevronUp, Truck, Settings, Calendar } from "lucide-react";

interface VisaoGeralFrotaMelhoradaProps {
  tipoVeiculo: TipoVeiculoDistribution[];
  statusOperacional: StatusOperacionalData[];
  idadeFrota: IdadeFrotaData[];
  isLoading: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function VisaoGeralFrotaMelhorada({ 
  tipoVeiculo, 
  statusOperacional, 
  idadeFrota, 
  isLoading 
}: VisaoGeralFrotaMelhoradaProps) {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [expandedIdade, setExpandedIdade] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Card key={i} className="h-80">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-60 bg-gray-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const toggleStatusExpanded = (status: string) => {
    setExpandedStatus(expandedStatus === status ? null : status);
  };

  const toggleIdadeExpanded = (faixa: string) => {
    setExpandedIdade(expandedIdade === faixa ? null : faixa);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Visão Geral da Frota</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por Tipo de Veículo - Simplificado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Tipo de Veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tipoVeiculo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentual }) => `${percentual.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="quantidade"
                  >
                    {tipoVeiculo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [
                      `${value} unidades (${tipoVeiculo.find(t => t.quantidade === value)?.percentual?.toFixed(1) || 0}%)`,
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ccc',
                      borderRadius: '8px',
                      padding: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      fontWeight: 500
                    }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{
                      paddingTop: '15px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Operacional - Com detalhes expandíveis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Operacional Detalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusOperacional}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {statusOperacional.map((status) => (
                <div key={status.status} className="border rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{status.status}</Badge>
                      <span className="text-sm font-medium">{status.quantidade} unidades</span>
                    </div>
                    {status.ativos.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatusExpanded(status.status)}
                      >
                        {expandedStatus === status.status ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {expandedStatus === status.status && (
                    <div className="mt-2 space-y-1">
                      {status.ativos.map((ativo) => (
                        <div 
                          key={ativo.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                        >
                          <span className="flex items-center gap-2">
                            {ativo.tipo_veiculo?.toLowerCase().includes('caminhão') ? (
                              <Truck className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Settings className="h-3 w-3 text-green-600" />
                            )}
                            <span className="font-medium">
                              {ativo.frota} {ativo.numero_frota}
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            {ativo.modelo}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Idade da Frota - Com detalhes expandíveis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Idade da Frota Detalhada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={idadeFrota}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="faixaIdade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {idadeFrota.map((faixa) => (
                <div key={faixa.faixaIdade} className="border rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">{faixa.faixaIdade}</span>
                      <Badge variant="outline">{faixa.quantidade}</Badge>
                    </div>
                    {faixa.ativos.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleIdadeExpanded(faixa.faixaIdade)}
                      >
                        {expandedIdade === faixa.faixaIdade ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {expandedIdade === faixa.faixaIdade && (
                    <div className="mt-2 space-y-1">
                      {faixa.ativos.map((ativo) => (
                        <div 
                          key={ativo.id}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
                        >
                          <span className="flex items-center gap-2">
                            {ativo.tipo_veiculo?.toLowerCase().includes('caminhão') ? (
                              <Truck className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Settings className="h-3 w-3 text-green-600" />
                            )}
                            <span className="font-medium">
                              {ativo.frota} {ativo.numero_frota}
                            </span>
                          </span>
                          <div className="text-right">
                            <div className="text-muted-foreground">
                              {ativo.modelo}
                            </div>
                            <div className="font-medium">
                              {ativo.ano_fabricacao}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
