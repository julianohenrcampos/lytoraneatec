import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SSODistribuicaoChartProps {
  distribuicao: {
    critico: number;
    em_atencao: number;
    satisfatorio: number;
    excelente: number;
  };
}

export const SSODistribuicaoChart = ({ distribuicao }: SSODistribuicaoChartProps) => {
  const data = [
    { name: 'Crítico', value: distribuicao.critico, color: '#ef4444' },
    { name: 'Em Atenção', value: distribuicao.em_atencao, color: '#f59e0b' },
    { name: 'Satisfatório', value: distribuicao.satisfatorio, color: '#3b82f6' },
    { name: 'Excelente', value: distribuicao.excelente, color: '#10b981' },
  ].filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Distribuição de Resultados</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sem dados disponíveis
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Distribuição de Resultados</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
