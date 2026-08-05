// Biblioteca de POPs — leitura para usuários com ação 'visualizar'.
// Exibe somente documentos vigentes (status = 'ativo').

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Loader2, Search } from 'lucide-react';
import { usePopsBiblioteca, usePopsGate } from '@/hooks/pops/usePopsData';
import PopCard from './PopCard';
import PopViewerDialog from './PopViewerDialog';
import type { PopComRascunho } from '@/types/pops';


const PopsBibliotecaPage: React.FC = () => {
  const { data: disponivel, isLoading: gateLoading } = usePopsGate();
  const habilitado = disponivel === true;
  const { data: pops = [], isLoading } = usePopsBiblioteca(habilitado);

  const [busca, setBusca] = useState('');
  const [setor, setSetor] = useState('todos');
  const [selecionado, setSelecionado] = useState<PopComRascunho | null>(null);

  const setores = useMemo(() => {
    const map = new Map<string, string>();
    pops.forEach((p) => {
      if (p.setor_id) map.set(p.setor_id, p.setor_nome || 'Sem setor');
    });
    return Array.from(map.entries());
  }, [pops]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pops.filter((p) => {
      const okSetor = setor === 'todos' || p.setor_id === setor;
      const okTermo =
        !termo ||
        p.codigo.toLowerCase().includes(termo) ||
        p.titulo.toLowerCase().includes(termo) ||
        (p.categoria || '').toLowerCase().includes(termo);
      return okSetor && okTermo;
    });
  }, [pops, busca, setor]);

  if (gateLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!habilitado) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          O módulo de POPs está em homologação e ainda não foi liberado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por código, título ou categoria"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger>
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setores.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setBusca('');
                setSetor('todos');
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Procedimentos vigentes ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-6 w-6" />
              Nenhum POP vigente encontrado.
            </div>
          ) : (
            <div
              data-testid="pops-grid"
              className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            >
              {filtrados.map((p) => (
                <PopCard
                  key={p.id}
                  id={p.id}
                  codigo={p.codigo}
                  titulo={p.titulo}
                  setor={p.setor_nome}
                  categoria={p.categoria}
                  versaoMajor={p.versao_major}
                  versaoMinor={p.versao_minor}
                  elaboradoPor={p.elaborado_por_nome_snapshot}
                  publicadoEm={p.publicado_em}
                  disabled={!p.arquivo_path}
                  onVisualizar={() => setSelecionado(p)}
                />
              ))}
            </div>
          )}

        </CardContent>
      </Card>

      <PopViewerDialog
        pop={selecionado}
        origem="vigente"
        open={Boolean(selecionado)}
        onOpenChange={(o) => !o && setSelecionado(null)}
      />
    </div>
  );
};

export default PopsBibliotecaPage;
