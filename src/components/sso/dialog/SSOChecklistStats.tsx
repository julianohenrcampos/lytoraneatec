import { Card } from '@/components/ui/card';
import { ssoCalculations } from '@/utils/sso/ssoCalculations';
import { ResultadoAvaliacao } from '@/types/sso';
import { useIsMobile } from '@/hooks/use-mobile';

interface SSOChecklistStatsProps {
  nota_objetivo: number;
  nota_real: number | null;
  total_aplicaveis: number;
  total_conformes: number;
  total_na: number;
}

export const SSOChecklistStats = ({
  nota_objetivo,
  nota_real,
  total_aplicaveis,
  total_conformes,
  total_na,
}: SSOChecklistStatsProps) => {
  const resultado = ssoCalculations.classificarNota(nota_real);
  const resultadoColor = ssoCalculations.getResultadoColor(resultado);
  const isMobile = useIsMobile();

  // Layout compacto para mobile
  if (isMobile) {
    return (
      <Card className="p-2 mb-3 bg-muted/50">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Nota:</span>
            <span className="font-bold">
              {nota_real !== null ? nota_real.toFixed(2) : '-'}
            </span>
          </div>
          
          {resultado && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${resultadoColor}`}>
              {resultado}
            </span>
          )}
          
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Aplicáveis:</span>
            <span className="font-semibold">{total_aplicaveis}/35</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-green-600 font-semibold">{total_conformes}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-gray-500 font-semibold">{total_na}</span>
          </div>
        </div>
      </Card>
    );
  }

  // Layout desktop (original)
  return (
    <Card className="p-4 mb-6 bg-muted/50">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Nota Objetivo</p>
          <p className="text-2xl font-bold text-primary">{nota_objetivo}</p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Nota Real</p>
          <p className="text-2xl font-bold">
            {nota_real !== null ? nota_real.toFixed(2) : '-'}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Resultado</p>
          {resultado ? (
            <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full border ${resultadoColor}`}>
              {resultado}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Aplicáveis</p>
          <p className="text-xl font-semibold">{total_aplicaveis} / 35</p>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Conformes / NA</p>
          <p className="text-xl font-semibold">
            <span className="text-green-600">{total_conformes}</span>
            {' / '}
            <span className="text-gray-500">{total_na}</span>
          </p>
        </div>
      </div>
    </Card>
  );
};
