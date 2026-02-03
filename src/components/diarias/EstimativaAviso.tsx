import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EstimativaAvisoProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export function EstimativaAviso({ className, variant = 'default' }: EstimativaAvisoProps) {
  if (variant === 'compact') {
    return (
      <p className={`text-xs text-amber-600 flex items-center gap-1 ${className || ''}`}>
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Este total é estimado e pode mudar conforme os dias efetivamente trabalhados.
      </p>
    );
  }

  return (
    <Alert className={`border-amber-200 bg-amber-50 ${className || ''}`}>
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800">
        <strong>Esta solicitação é uma estimativa.</strong>
        <br />
        O valor real será calculado somente após a confirmação de presença nos dias efetivamente trabalhados.
      </AlertDescription>
    </Alert>
  );
}
