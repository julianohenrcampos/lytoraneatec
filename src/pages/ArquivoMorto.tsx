import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Archive, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

const ArquivoMorto = () => {
  const [busca, setBusca] = useState('');

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['arquivo-morto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_arquivo_morto')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtrados = registros.filter((r: any) => {
    if (!busca) return true;
    const s = busca.toLowerCase();
    return (
      r.nome_completo?.toLowerCase().includes(s) ||
      r.cpf?.toLowerCase().includes(s)
    );
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Archive className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Arquivo Morto</h1>
            <p className="text-sm text-muted-foreground">
              Funcionários desligados — {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : (
          <div className="rounded-md border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">CPF</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Motivo</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data Desligamento</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">Recontratável</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{r.nome_completo}</td>
                        <td className="px-4 py-3">{r.cpf || '—'}</td>
                        <td className="px-4 py-3">{r.motivo_desligamento || '—'}</td>
                        <td className="px-4 py-3">
                          {r.data_desligamento
                            ? format(new Date(r.data_desligamento + 'T12:00:00'), 'dd/MM/yyyy')
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {r.tipo_desligamento === 'sem_aviso' ? 'Sem Aviso' : r.tipo_desligamento === 'com_aviso' ? 'Com Aviso' : r.tipo_desligamento || '—'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.recontratavel ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate" title={r.observacoes || ''}>
                          {r.observacoes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ArquivoMorto;
