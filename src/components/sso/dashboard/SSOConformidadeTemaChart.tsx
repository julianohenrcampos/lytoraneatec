import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface SSOConformidadeTemaChartProps {
  conformidadePorTema: {
    tema: string;
    conformidade: number;
    total_avaliacoes: number;
  }[];
}

export const SSOConformidadeTemaChart = ({ conformidadePorTema }: SSOConformidadeTemaChartProps) => {
  if (!conformidadePorTema || conformidadePorTema.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Conformidade por Tema</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sem dados disponíveis
        </div>
      </Card>
    );
  }

  const getColor = (conformidade: number) => {
    if (conformidade >= 90) return '#10b981';
    if (conformidade >= 75) return '#3b82f6';
    if (conformidade >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const data = conformidadePorTema.map(item => ({
    ...item,
    conformidadeLabel: `${item.conformidade.toFixed(1)}%`
  }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Conformidade por Tema</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Temas ordenados do menor ao maior percentual (críticos primeiro)
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} />
          <YAxis 
            dataKey="tema" 
            type="category" 
            width={150}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(1)}%`}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))'
            }}
          />
          <Bar dataKey="conformidade" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.conformidade)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
