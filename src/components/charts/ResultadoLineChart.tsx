import { 
  ComposedChart, 
  Line, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export interface EstatisticaMensal {
  mes: string;
  mesFormatado: string;
  ganhou: number;
  perdeu: number;
}

interface ResultadoLineChartProps {
  data: EstatisticaMensal[];
  title: string;
  description?: string;
  height?: number;
}

export function ResultadoLineChart({ 
  data, 
  title, 
  description, 
  height = 300 
}: ResultadoLineChartProps) {
  const hasData = data.length > 0 && data.some(d => d.ganhou > 0 || d.perdeu > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div 
            className="flex flex-col items-center justify-center text-muted-foreground"
            style={{ height }}
          >
            <TrendingUp className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">Sem dados disponíveis</p>
            <p className="text-xs mt-1">
              Atualize o status das licitações para visualizar a evolução
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart 
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mesFormatado" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => [
                  `${value} licitação(ões)`,
                  name === 'ganhou' ? 'Ganhou' : 'Perdeu'
                ]}
              />
              <Legend 
                formatter={(value) => value === 'ganhou' ? 'Ganhou' : 'Perdeu'}
              />
              <Bar dataKey="ganhou" barSize={20} fill="#22c55e" name="ganhou" />
              <Bar dataKey="perdeu" barSize={20} fill="#ef4444" name="perdeu" />
              <Line 
                type="monotone" 
                dataKey="ganhou" 
                stroke="#16a34a" 
                strokeWidth={2}
                dot={{ fill: '#16a34a', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="perdeu" 
                stroke="#dc2626" 
                strokeWidth={2}
                dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}