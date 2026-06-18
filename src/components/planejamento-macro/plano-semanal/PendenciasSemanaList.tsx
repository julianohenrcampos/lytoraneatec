import React from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Pendencia } from "@/lib/planejamentoMacro/planoSemanal/tipos";

const TIPO_LABEL: Record<string, string> = {
  FUNCAO_NAO_MAPEADA: "Função não mapeada",
  FAMILIA_DESCONHECIDA: "Família desconhecida",
  FORA_DO_ESCOPO_OPERACIONAL: "Fora do escopo operacional",
  EQUIPAMENTO_SEM_CATALOGO: "Equipamento sem catálogo",
  MATERIAL_SEM_UNIDADE: "Material sem unidade",
  RECURSO_SEM_ATIVIDADE: "Recurso sem atividade",
  recurso_sem_horas: "Recurso sem horas",
  recurso_sem_data: "Recurso sem data",
  unidade_divergente: "Unidade divergente",
  atividade_sem_duracao: "Atividade sem duração",
  funcao_sem_mapeamento: "Função sem descrição",
};

const PendenciasSemanaList: React.FC<{ pendencias: Pendencia[] }> = ({ pendencias }) => {
  if (pendencias.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        Nenhuma pendência identificada.
      </p>
    );
  }
  return (
    <ul className="divide-y border rounded-md">
      {pendencias.map((p, i) => (
        <li key={i} className="p-3 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{p.item ?? p.descricao}</span>
              <Badge variant="outline" className="text-[10px]">
                {TIPO_LABEL[p.tipo] ?? p.tipo}
              </Badge>
              {p.familiaDetectada ? (
                <Badge variant="secondary" className="text-[10px]">
                  {p.familiaDetectada}
                </Badge>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{p.descricao}</div>
            {p.acaoSugerida ? (
              <div className="text-xs text-muted-foreground mt-0.5">
                <span className="font-medium">Ação:</span> {p.acaoSugerida}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default PendenciasSemanaList;
