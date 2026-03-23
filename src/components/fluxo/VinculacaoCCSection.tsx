import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAllVinculacoesAtivas } from "@/services/fluxoAprovacaoConfigService";

interface Props {
  selectedCCIds: string[];
  onChange: (ids: string[]) => void;
  fluxoId?: string;
}

export default function VinculacaoCCSection({ selectedCCIds, onChange, fluxoId }: Props) {
  const { centrosCusto, isLoading } = useCentrosCusto();
  const [conflitos, setConflitos] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllVinculacoesAtivas().then((vinculacoes) => {
      const map: Record<string, string> = {};
      vinculacoes.forEach((v) => {
        if (v.fluxo_id !== fluxoId) {
          map[v.centro_custo_id] = v.fluxo_id;
        }
      });
      setConflitos(map);
    });
  }, [fluxoId]);

  const available = centrosCusto.filter(
    (cc) => cc.situacao !== "Inativo" && !selectedCCIds.includes(cc.id)
  );

  const addCC = (ccId: string) => {
    onChange([...selectedCCIds, ccId]);
  };

  const removeCC = (ccId: string) => {
    onChange(selectedCCIds.filter((id) => id !== ccId));
  };

  const getCC = (id: string) => centrosCusto.find((cc) => cc.id === id);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Centros de Custo Vinculados</Label>

      <Select onValueChange={addCC}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Carregando..." : "Selecionar centro de custo..."} />
        </SelectTrigger>
        <SelectContent>
          {available.map((cc) => (
            <SelectItem key={cc.id} value={cc.id}>
              {cc.codigo_centro_custo} - {cc.nome_centro_custo}
              {conflitos[cc.id] && " ⚠️"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedCCIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCCIds.map((ccId) => {
            const cc = getCC(ccId);
            const hasConflict = !!conflitos[ccId];
            return (
              <Badge
                key={ccId}
                variant={hasConflict ? "destructive" : "secondary"}
                className="flex items-center gap-1 pr-1"
              >
                {cc ? `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}` : ccId}
                {hasConflict && <span className="text-[10px]">(outro fluxo)</span>}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1"
                  onClick={() => removeCC(ccId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {selectedCCIds.some((id) => conflitos[id]) && (
        <p className="text-xs text-destructive">
          ⚠️ Centros de custo marcados já possuem outro fluxo ativo. A vinculação anterior será desativada ao salvar.
        </p>
      )}
    </div>
  );
}
