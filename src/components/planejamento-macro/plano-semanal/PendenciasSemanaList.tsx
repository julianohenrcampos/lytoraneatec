// Fase 1C-2A — Rastreabilidade.
// Fase 1C-2B — Correção Assistida.
// Lista de pendências do Saneamento agrupada por tipo, com metadados da atividade
// (EAP, período, status, criticidade, qtd/unidade/origem), badge de semana
// selecionada e ações: Abrir no Cronograma, Abrir na Semana, Corrigir quantidade/unidade,
// Designar equipe, Mapear equipamento.

import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  GrupoPendencia,
  Pendencia,
} from "@/lib/planejamentoMacro/planoSemanal/tipos";
import { formatarPeriodoBR } from "@/components/planejamento-macro/shared/formatData";

const TIPO_LABEL: Record<string, string> = {
  FUNCAO_NAO_MAPEADA: "Função não mapeada",
  FAMILIA_DESCONHECIDA: "Família desconhecida",
  FORA_DO_ESCOPO_OPERACIONAL: "Fora do escopo operacional",
  EQUIPAMENTO_SEM_CATALOGO: "Equipamento sem catálogo",
  MATERIAL_SEM_UNIDADE: "Material sem unidade",
  RECURSO_SEM_ATIVIDADE: "Recurso sem atividade",
  ATIVIDADE_SEM_QUANTIDADE: "Atividade sem quantidade",
  ATIVIDADE_SEM_UNIDADE: "Atividade sem unidade",
  ATIVIDADE_CRITICA_SEM_EQUIPE: "Atividade crítica sem equipe",
  recurso_sem_horas: "Recurso sem horas",
  recurso_sem_data: "Recurso sem data",
  unidade_divergente: "Unidade divergente",
  atividade_sem_duracao: "Atividade sem duração",
  funcao_sem_mapeamento: "Função sem descrição",
};

const GRUPO_LABEL: Record<GrupoPendencia, string> = {
  critica: "Críticas",
  atividade: "Atividades",
  mao_obra: "Mão de obra",
  equipamento: "Equipamentos",
  material: "Materiais",
  fora_escopo: "Recursos fora do escopo operacional",
  outros: "Outros",
};

const GRUPO_ORDEM: GrupoPendencia[] = [
  "critica",
  "atividade",
  "mao_obra",
  "equipamento",
  "material",
  "fora_escopo",
  "outros",
];

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

function originLabel(origem: string | null | undefined): string {
  if (!origem) return "—";
  const k = origem.toLowerCase();
  if (k === "manual") return "Manual";
  if (k === "planilha") return "Planilha";
  if (k === "indefinido") return "Indefinido";
  return origem;
}

export interface PendenciasSemanaListProps {
  pendencias: Pendencia[];
  onAbrirNoCronograma?: (atividadeId: string) => void;
  onAbrirNaSemana?: (atividadeId: string, dataInicioIso: string) => void;
  onCorrigirQuantidade?: (atividadeId: string) => void;
  canCorrigirQuantidade?: boolean;
  onDesignarEquipe?: (atividadeId: string) => void;
  canDesignarEquipe?: boolean;
  onMapearEquipamento?: (item: string) => void;
}

const PendenciasSemanaList: React.FC<PendenciasSemanaListProps> = ({
  pendencias,
  onAbrirNoCronograma,
  onAbrirNaSemana,
  onCorrigirQuantidade,
  canCorrigirQuantidade = false,
  onDesignarEquipe,
  canDesignarEquipe = false,
  onMapearEquipamento,
}) => {
  const agrupado = useMemo(() => {
    const m = new Map<GrupoPendencia, Pendencia[]>();
    for (const p of pendencias) {
      const g = (p.grupo ?? "outros") as GrupoPendencia;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(p);
    }
    return m;
  }, [pendencias]);

  const totalCriticas = pendencias.filter(
    (p) => (p.severidade ?? "critica") === "critica"
  ).length;
  const totalAvisos = pendencias.length - totalCriticas;

  if (pendencias.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        Nenhuma pendência identificada.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{pendencias.length}</strong> pendência(s)
        </span>
        <span>•</span>
        <span>
          <strong className="text-destructive">{totalCriticas}</strong> crítica(s)
        </span>
        <span>•</span>
        <span>
          <strong className="text-amber-600">{totalAvisos}</strong> aviso(s)
        </span>
      </div>

      {GRUPO_ORDEM.filter((g) => agrupado.has(g)).map((g) => {
        const lista = agrupado.get(g)!;
        return (
          <div key={g} className="border rounded-md overflow-hidden">
            <div className="px-3 py-2 bg-muted/50 text-xs font-semibold flex items-center justify-between">
              <span>{GRUPO_LABEL[g]}</span>
              <span className="text-muted-foreground">
                {lista.length} pendência(s)
              </span>
            </div>
            <ul className="divide-y">
              {lista.map((p, i) => (
                <PendenciaItem
                  key={`${g}-${i}`}
                  p={p}
                  onAbrirNoCronograma={onAbrirNoCronograma}
                  onAbrirNaSemana={onAbrirNaSemana}
                  onCorrigirQuantidade={onCorrigirQuantidade}
                  canCorrigirQuantidade={canCorrigirQuantidade}
                  onDesignarEquipe={onDesignarEquipe}
                  canDesignarEquipe={canDesignarEquipe}
                  onMapearEquipamento={onMapearEquipamento}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

const PendenciaItem: React.FC<{
  p: Pendencia;
  onAbrirNoCronograma?: (atividadeId: string) => void;
  onAbrirNaSemana?: (atividadeId: string, dataInicioIso: string) => void;
  onCorrigirQuantidade?: (atividadeId: string) => void;
  canCorrigirQuantidade: boolean;
  onDesignarEquipe?: (atividadeId: string) => void;
  canDesignarEquipe: boolean;
  onMapearEquipamento?: (item: string) => void;
}> = ({
  p,
  onAbrirNoCronograma,
  onAbrirNaSemana,
  onCorrigirQuantidade,
  canCorrigirQuantidade,
  onDesignarEquipe,
  canDesignarEquipe,
  onMapearEquipamento,
}) => {
  const sev = p.severidade ?? "critica";
  const dentro = p.dentroDaSemanaSelecionada;
  const statusLabel = p.statusAtividade
    ? STATUS_LABEL[p.statusAtividade.toLowerCase()] ?? p.statusAtividade
    : null;

  const podeAbrirSemana = !!onAbrirNaSemana && !!p.atividadeId && !!p.periodoInicio;
  const podeAbrirCronograma = !!onAbrirNoCronograma && !!p.atividadeId;
  const podeCorrigir =
    canCorrigirQuantidade &&
    !!onCorrigirQuantidade &&
    !!p.atividadeId &&
    (p.tipo === "ATIVIDADE_SEM_QUANTIDADE" || p.tipo === "ATIVIDADE_SEM_UNIDADE");
  const podeDesignar =
    canDesignarEquipe &&
    !!onDesignarEquipe &&
    !!p.atividadeId &&
    p.tipo === "ATIVIDADE_CRITICA_SEM_EQUIPE";
  const podeMapear =
    !!onMapearEquipamento && p.tipo === "EQUIPAMENTO_SEM_CATALOGO";

  return (
    <li className="p-3 flex items-start gap-3 text-sm">
      <AlertTriangle
        className={`h-4 w-4 mt-0.5 shrink-0 ${
          sev === "critica" ? "text-destructive" : "text-amber-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{p.item ?? p.descricao}</span>
          <Badge variant="outline" className="text-[10px]">
            {TIPO_LABEL[p.tipo] ?? p.tipo}
          </Badge>
          <Badge
            variant={sev === "critica" ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {sev === "critica" ? "Crítica" : "Aviso"}
          </Badge>
          {p.isCritica ? (
            <Badge
              variant="outline"
              className="text-[10px] border-destructive text-destructive"
            >
              Crítica (cronograma)
            </Badge>
          ) : null}
          {dentro === true && (
            <Badge variant="secondary" className="text-[10px]">
              Na semana selecionada
            </Badge>
          )}
          {dentro === false && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Fora da semana selecionada
            </Badge>
          )}
          {p.familiaDetectada ? (
            <Badge variant="secondary" className="text-[10px]">
              {p.familiaDetectada}
            </Badge>
          ) : null}
        </div>

        <div className="text-xs text-muted-foreground mt-1">{p.descricao}</div>

        {(p.eap ||
          p.periodoInicio ||
          statusLabel ||
          p.quantidadePrevista != null ||
          p.unidade ||
          p.quantidadeOrigem) && (
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {p.eap && (
              <div>
                <span className="font-medium">EAP:</span>{" "}
                <span className="font-mono">{p.eap}</span>
              </div>
            )}
            {p.periodoInicio && p.periodoFim && (
              <div>
                <span className="font-medium">Período:</span>{" "}
                {formatarPeriodoBR(p.periodoInicio, p.periodoFim)}
              </div>
            )}
            {statusLabel && (
              <div>
                <span className="font-medium">Status:</span> {statusLabel}
              </div>
            )}
            {p.quantidadePrevista != null && (
              <div>
                <span className="font-medium">Quantidade:</span> {p.quantidadePrevista}
                {p.unidade ? ` ${p.unidade}` : ""}
              </div>
            )}
            {p.quantidadePrevista == null && p.unidade && (
              <div>
                <span className="font-medium">Unidade:</span> {p.unidade}
              </div>
            )}
            {(p.quantidadeOrigem || p.quantidadePrevista != null) && (
              <div>
                <span className="font-medium">Origem:</span>{" "}
                {originLabel(p.quantidadeOrigem)}
              </div>
            )}
          </div>
        )}

        {p.acaoSugerida ? (
          <div className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Ação:</span> {p.acaoSugerida}
          </div>
        ) : null}

        {(podeAbrirCronograma ||
          podeAbrirSemana ||
          podeCorrigir ||
          podeDesignar ||
          podeMapear) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {podeAbrirCronograma && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onAbrirNoCronograma!(p.atividadeId!)}
              >
                Abrir no Cronograma
              </Button>
            )}
            {podeAbrirSemana && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onAbrirNaSemana!(p.atividadeId!, p.periodoInicio!)}
              >
                Abrir na Semana da Atividade
              </Button>
            )}
            {podeCorrigir && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => onCorrigirQuantidade!(p.atividadeId!)}
              >
                Corrigir quantidade/unidade
              </Button>
            )}
            {podeDesignar && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => onDesignarEquipe!(p.atividadeId!)}
              >
                Designar equipe
              </Button>
            )}
            {podeMapear && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onMapearEquipamento!(p.item ?? "")}
              >
                Mapear equipamento
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

export default PendenciasSemanaList;
