
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CentroCustoUtilizacao } from "@/types/maquinas";

interface UtilizacaoEficienciaRoscaProps {
  centroCustoData: CentroCustoUtilizacao[];
  isLoading: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'];

export default function UtilizacaoEficienciaRosca({ 
  centroCustoData, 
  isLoading 
}: UtilizacaoEficienciaRoscaProps) {
  // Função para extrair código do centro de custo
  const extractCode = (centroCusto: string) => {
    // Extrair código antes do " - " se existir
    const parts = centroCusto.split(' - ');
    return parts.length > 1 ? parts[0] : centroCusto;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
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
      </div>
    );
  }

  // Preparar dados para horas trabalhadas
  const dadosHoras = centroCustoData
    .filter(item => item.totalHoras > 0)
    .map(item => ({
      name: extractCode(item.centroCusto),
      fullName: item.centroCusto,
      value: item.totalHoras,
      label: `${item.totalHoras.toFixed(1)}h`
    }));

  // Preparar dados para consumo de combustível
  const dadosCombustivel = centroCustoData
    .filter(item => item.totalCombustivel > 0)
    .map(item => ({
      name: extractCode(item.centroCusto),
      fullName: item.centroCusto,
      value: item.totalCombustivel,
      label: `${item.totalCombustivel.toFixed(1)}L`
    }));

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Só mostrar o label para fatias maiores que 5%
    const total = dadosHoras.reduce((sum, item) => sum + item.value, 0);
    const percent = (value / total) * 100;
    
    return percent >= 5 ? (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
        stroke="#00000033"
        strokeWidth={0.5}
        style={{ 
          filter: 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.5))' 
        }}
      >
        {name}
      </text>
    ) : null;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Utilização e Eficiência</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horas Trabalhadas por Centro de Custo - Gráfico de Rosca */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas Trabalhadas por Centro de Custo</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosHoras.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosHoras}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {dadosHoras.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          stroke="#ffffff"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any) => [
                        `${Number(value).toFixed(1)} horas`, 
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
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado de horas trabalhadas disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consumo de Combustível por Centro - Gráfico de Rosca */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo de Combustível por Centro</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosCombustivel.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosCombustivel}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: any) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                        const total = dadosCombustivel.reduce((sum, item) => sum + item.value, 0);
                        const percent = (value / total) * 100;
                        
                        return percent >= 5 ? (
                          <text 
                            x={x} 
                            y={y} 
                            fill="white" 
                            textAnchor={x > cx ? 'start' : 'end'} 
                            dominantBaseline="central"
                            className="text-xs font-medium"
                            stroke="#00000033"
                            strokeWidth={0.5}
                            style={{ 
                              filter: 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.5))' 
                            }}
                          >
                            {name}
                          </text>
                        ) : null;
                      }}
                      outerRadius={80}
                      innerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {dadosCombustivel.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          stroke="#ffffff"
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any) => [
                        `${Number(value).toFixed(1)} litros`, 
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
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado de consumo de combustível disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
