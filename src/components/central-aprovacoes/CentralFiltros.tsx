import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Filter, Search } from 'lucide-react';

interface Option { value: string; label: string }
interface Props {
  centroCusto: string; setCentroCusto: (v: string) => void;
  centrosCustoOptions: Option[];
  status: string; setStatus: (v: string) => void;
  statusOptions: Option[];
  solicitante: string; setSolicitante: (v: string) => void;
  solicitantesOptions: Option[];
  apenasMinhas: boolean; setApenasMinhas: (v: boolean) => void;
  busca: string; setBusca: (v: string) => void;
}

export default function CentralFiltros(p: Props) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" /> Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Centro de Custo</Label>
            <Combobox options={p.centrosCustoOptions} value={p.centroCusto} onChange={p.setCentroCusto} placeholder="Selecione..." searchPlaceholder="Buscar CC..." emptyText="Nenhum CC" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Combobox options={p.statusOptions} value={p.status} onChange={p.setStatus} placeholder="Selecione..." searchPlaceholder="Buscar status..." emptyText="Nenhum status" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Solicitante</Label>
            <Combobox options={p.solicitantesOptions} value={p.solicitante} onChange={p.setSolicitante} placeholder="Selecione..." searchPlaceholder="Buscar solicitante..." emptyText="Nenhum" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buscar (protocolo, obra, solicitante)</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={p.busca} onChange={(e) => p.setBusca(e.target.value)} placeholder="Digite para filtrar..." className="pl-8" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Switch id="apenas-minhas" checked={p.apenasMinhas} onCheckedChange={p.setApenasMinhas} />
          <Label htmlFor="apenas-minhas" className="text-sm cursor-pointer">Apenas aguardando minha ação</Label>
        </div>
      </CardContent>
    </Card>
  );
}
