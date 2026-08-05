import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Network } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

interface CentroCustoOption {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo?: string;
}

interface Props {
  centrosCusto: CentroCustoOption[];
  centroCustoId: string | null;
  onCentroCustoChange: (id: string | null) => void;
  loading?: boolean;
  headerAction?: React.ReactNode;
  tituloPrincipal?: string;
  subtitulo?: string;
  onAbrirVersoes?: () => void;
  /** Fase 7C — abre o modal de Estrutura EAP. */
  onAbrirEstruturaEap?: () => void;
  /** Fase 7C — badge discreto quando há versão vigente ativa. */
  vigenteAtivo?: boolean;
}

const PlanejamentoMacroHeader: React.FC<Props> = ({
  centrosCusto,
  centroCustoId,
  onCentroCustoChange,
  loading,
  headerAction,
  tituloPrincipal,
  subtitulo,
  onAbrirVersoes,
  onAbrirEstruturaEap,
  vigenteAtivo = false,
}) => {
  const semCC = !loading && centrosCusto.length === 0;
  const titulo = tituloPrincipal ?? "Planejamento Macro da Obra";
  const sub =
    subtitulo ??
    "Visão consolidada de atividades, mão de obra, equipamentos e pendências por centro de custo.";

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {titulo}
            </h1>
            <p className="text-sm text-muted-foreground">{sub}</p>
          </div>
          {centroCustoId && vigenteAtivo && (
            <Badge variant="outline" className="mt-1 border-primary/40 text-primary">
              Versão vigente ativa
            </Badge>
          )}
        </div>
        {(headerAction || (centroCustoId && (onAbrirVersoes || onAbrirEstruturaEap))) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {centroCustoId && onAbrirEstruturaEap && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAbrirEstruturaEap}
                className="gap-1"
                title="EAP corresponde ao WBS importado do MS Project."
              >
                <Network className="h-4 w-4" />
                Estrutura EAP
              </Button>
            )}
            {centroCustoId && onAbrirVersoes && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAbrirVersoes}
                className="gap-1"
              >
                <History className="h-4 w-4" />
                Ver versões
              </Button>
            )}
            {headerAction}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Centro de Custo</Label>
              <Combobox
                options={centrosCusto.map<ComboboxOption>((cc) => ({
                  value: cc.id,
                  label: cc.codigo_centro_custo
                    ? `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
                    : cc.nome_centro_custo,
                }))}
                value={centroCustoId ?? ""}
                onChange={(v) => onCentroCustoChange(v || null)}
                disabled={loading || semCC}
                placeholder={
                  loading
                    ? "Carregando centros de custo..."
                    : semCC
                      ? "Nenhum centro de custo no seu escopo"
                      : "Selecione um centro de custo"
                }
                searchPlaceholder="Buscar por código ou nome..."
                emptyText="Nenhum centro de custo encontrado"
              />
              {semCC && (
                <p className="text-xs text-muted-foreground mt-1">
                  Solicite ao administrador a vinculação de um centro de custo ao seu usuário.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanejamentoMacroHeader;
