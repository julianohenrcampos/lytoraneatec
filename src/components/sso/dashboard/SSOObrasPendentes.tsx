import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SSOObrasPendentesProps {
  obras: {
    id: string;
    nome_centro_custo: string;
    codigo_centro_custo: string;
  }[];
}

export const SSOObrasPendentes = ({ obras }: SSOObrasPendentesProps) => {
  const navigate = useNavigate();

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Obras Pendentes</h3>
          <p className="text-sm text-muted-foreground">
            {obras.length} obra{obras.length !== 1 ? 's' : ''} sem checklist
          </p>
        </div>
        <Building2 className="h-6 w-6 text-muted-foreground" />
      </div>

      {obras.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <p>Todas as obras foram avaliadas! 🎉</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {obras.slice(0, 10).map((obra) => (
            <div
              key={obra.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{obra.nome_centro_custo}</p>
                <p className="text-sm text-muted-foreground">{obra.codigo_centro_custo}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/sso/checklists')}
                className="ml-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Criar
              </Button>
            </div>
          ))}
          {obras.length > 10 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              E mais {obras.length - 10} obra{obras.length - 10 !== 1 ? 's' : ''}...
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
