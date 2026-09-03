import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox } from "@/components/ui/combobox";
import { X } from "lucide-react";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { fetchAplicacoesAtivas } from "@/services/fluxoAplicacoesService";
import {
  PROCESSO_TIPO_LABELS,
  type AplicacaoFormData,
  type ProcessoTipo,
} from "@/types/fluxoAprovacao";

interface Props {
  value: AplicacaoFormData;
  onChange: (data: AplicacaoFormData) => void;
  fluxoId?: string;
}

const SEM_PROCESSO = "__NENHUM__";

export default function AplicacaoFluxoSection({ value, onChange, fluxoId }: Props) {
  const { centrosCusto, isLoading } = useCentrosCusto();
  const [conflitos, setConflitos] = useState<Record<string, true>>({});

  useEffect(() => {
    fetchAplicacoesAtivas()
      .then((aplicacoes) => {
        const map: Record<string, true> = {};
        aplicacoes.forEach((a) => {
          if (a.fluxo_id !== fluxoId) {
            map[`${a.processo_tipo}::${a.centro_custo_id ?? "__DEFAULT__"}`] = true;
          }
        });
        setConflitos(map);
      })
      .catch(() => setConflitos({}));
  }, [fluxoId]);

  const processoOptions = useMemo(
    () => [
      { value: SEM_PROCESSO, label: "Nenhum (fluxo não aplicado a processos)" },
      ...Object.entries(PROCESSO_TIPO_LABELS).map(([k, label]) => ({ value: k, label })),
    ],
    []
  );

  const ccOptions = useMemo(
    () =>
      centrosCusto
        .filter((cc) => cc.situacao !== "Inativo" && !value.centro_custo_ids.includes(cc.id))
        .map((cc) => ({
          value: cc.id,
          label: `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`,
          searchText: `${cc.codigo_centro_custo} ${cc.nome_centro_custo}`,
        })),
    [centrosCusto, value.centro_custo_ids]
  );

  const getCC = (id: string) => centrosCusto.find((cc) => cc.id === id);

  const conflitoDefault =
    value.processo_tipo && value.todos_centros_custo
      ? !!conflitos[`${value.processo_tipo}::__DEFAULT__`]
      : false;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Aplicação do Fluxo</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Define em qual processo corporativo este fluxo governa a aprovação. Diárias continuam no
          motor legado e não são configuradas aqui.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Processo</Label>
        <Combobox
          options={processoOptions}
          value={value.processo_tipo ?? SEM_PROCESSO}
          onChange={(v) =>
            onChange({
              ...value,
              processo_tipo: v === SEM_PROCESSO ? null : (v as ProcessoTipo),
            })
          }
          placeholder="Selecionar processo..."
          searchPlaceholder="Buscar processo..."
        />
      </div>

      {value.processo_tipo && (
        <>
          <div className="space-y-2">
            <Label className="text-xs">Aplicação</Label>
            <RadioGroup
              value={value.todos_centros_custo ? "todos" : "especificos"}
              onValueChange={(v) =>
                onChange({ ...value, todos_centros_custo: v === "todos" })
              }
              className="space-y-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="todos" id="aplic-todos" />
                <Label htmlFor="aplic-todos" className="text-sm font-normal">
                  Todos os Centros de Custo (fluxo padrão do processo)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="especificos" id="aplic-especificos" />
                <Label htmlFor="aplic-especificos" className="text-sm font-normal">
                  Centros de Custo específicos
                </Label>
              </div>
            </RadioGroup>
          </div>

          {conflitoDefault && (
            <p className="text-xs text-destructive">
              ⚠️ Já existe um fluxo padrão ativo para este processo. Ele será desativado ao salvar.
            </p>
          )}

          {!value.todos_centros_custo && (
            <div className="space-y-2">
              <Label className="text-xs">Centros de Custo</Label>
              <Combobox
                options={ccOptions}
                value=""
                onChange={(ccId) =>
                  ccId &&
                  onChange({ ...value, centro_custo_ids: [...value.centro_custo_ids, ccId] })
                }
                placeholder={isLoading ? "Carregando..." : "Adicionar centro de custo..."}
                searchPlaceholder="Buscar centro de custo..."
              />

              {value.centro_custo_ids.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {value.centro_custo_ids.map((ccId) => {
                    const cc = getCC(ccId);
                    const hasConflict = !!conflitos[`${value.processo_tipo}::${ccId}`];
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
                          onClick={() =>
                            onChange({
                              ...value,
                              centro_custo_ids: value.centro_custo_ids.filter((id) => id !== ccId),
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              {value.centro_custo_ids.some((id) => conflitos[`${value.processo_tipo}::${id}`]) && (
                <p className="text-xs text-destructive">
                  ⚠️ Centros marcados já possuem outro fluxo ativo neste processo. A aplicação
                  anterior será desativada ao salvar.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
