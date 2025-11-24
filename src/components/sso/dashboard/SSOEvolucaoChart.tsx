import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SSOEvolucaoChartProps {
  evolucaoTemporal: {
    data: string;
    nota_media: number;
    obra: string;
  }[];
}

export const SSOEvolucaoChart = ({ evolucaoTemporal }: SSOEvolucaoChartProps) => {
  if (!evolucaoTemporal || evolucaoTemporal.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Evolução Temporal das Notas</h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          Sem dados disponíveis
        </div>
      </Card>
    );
  }

  const data = evolucaoTemporal.map(item => ({
    ...item,
    dataFormatada: format(new Date(item.data), 'dd/MM', { locale: ptBR })
  }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Evolução Temporal das Notas</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Acompanhamento da nota média ao longo do tempo
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="dataFormatada" 
            tick={{ fontSize: 12 }}
          />
          <YAxis domain={[0, 100]} />
          <Tooltip 
            formatter={(value: number) => value.toFixed(1)}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="nota_media" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            name="Nota Média"
            dot={{ fill: 'hsl(var(--primary))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};
