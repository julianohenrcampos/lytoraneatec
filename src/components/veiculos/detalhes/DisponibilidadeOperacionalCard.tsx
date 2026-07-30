import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, CalendarClock, CalendarDays, ShieldAlert } from "lucide-react";
import AssetInfoSection from "./AssetInfoSection";
import AssetInfoItem from "./AssetInfoItem";
import { formatDataOperacional } from "./formatadores";
import type { StatusOperacionalCanonico } from "@/lib/ativos/reconciliacaoOperacional";
import type { EstadoOperacionalDetalhado } from "@/services/disponibilidadeEquipamentoService";
import { ACAO_LISTAGEM } from "@/components/disponibilidade/disponibilidadeFormLogic";

export const STATUS_OPERACIONAL_TEXTO: Record<StatusOperacionalCanonico, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_STATUS: "Sem status",
  DESCONHECIDO: "Status desconhecido",
};

const STATUS_CLASSES: Record<StatusOperacionalCanonico, string> = {
  DISPONIVEL: "border-transparent bg-emerald-100 text-emerald-800",
  ALOCADO: "border-transparent bg-sky-100 text-sky-800",
  MANUTENCAO: "border-transparent bg-primary/15 text-primary",
  INDISPONIVEL: "border-transparent bg-destructive/15 text-destructive",
  SEM_STATUS: "border-transparent bg-muted text-muted-foreground",
  DESCONHECIDO: "border-transparent bg-muted text-muted-foreground",
};

export interface DisponibilidadeOperacionalCardProps {
  estado?: EstadoOperacionalDetalhado;
  isLoading: boolean;
  isError: boolean;
  podeEditar: boolean;
  onEditar: () => void;
}

const DisponibilidadeOperacionalCard: React.FC<DisponibilidadeOperacionalCardProps> = ({
  estado,
  isLoading,
  isError,
  podeEditar,
  onEditar,
}) => {
  const acao =
    podeEditar && !!estado ? (
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={onEditar}
      >
        {estado.possuiRegistroDisponibilidade ? ACAO_LISTAGEM.EDIT : ACAO_LISTAGEM.CREATE}
      </Button>
    ) : null;

  return (
    <AssetInfoSection title="Disponibilidade operacional" icon={Activity} action={acao}>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError || !estado ? (
        <p className="text-sm text-destructive">
          Não foi possível consultar a disponibilidade operacional.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-2.5 py-1.5">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              {estado.possuiRegistroDisponibilidade ? (
                <Badge className={STATUS_CLASSES[estado.statusOperacional]}>
                  {STATUS_OPERACIONAL_TEXTO[estado.statusOperacional]}
                </Badge>
              ) : (
                <Badge className={STATUS_CLASSES.SEM_STATUS}>Sem registro operacional</Badge>
              )}
            </div>
          </div>

          <AssetInfoItem
            icon={CalendarDays}
            label="Data de início"
            value={formatDataOperacional(estado.registro?.dataInicio, "")}
            emptyLabel="Não registrada"
          />
          <AssetInfoItem
            icon={CalendarClock}
            label="Previsão de liberação"
            value={formatDataOperacional(estado.registro?.previsaoLiberacao, "")}
            emptyLabel="Não informada"
          />
          {estado.registro?.confiabilidadePrevisao ? (
            <AssetInfoItem
              icon={ShieldAlert}
              label="Confiabilidade"
              value={estado.registro.confiabilidadePrevisao}
            />
          ) : null}
          {estado.registro?.motivoRisco ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <AssetInfoItem icon={ShieldAlert} label="Motivo / risco" value={estado.registro.motivoRisco} />
            </div>
          ) : null}
        </div>
      )}
    </AssetInfoSection>
  );
};

export default DisponibilidadeOperacionalCard;
