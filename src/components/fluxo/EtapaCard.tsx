import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { EtapaFormData, TipoAprovador } from "@/types/fluxoAprovacao";
import { TIPO_APROVADOR_LABELS } from "@/types/fluxoAprovacao";
import { fetchProfilesElegiveis, fetchPermissoesFluxo } from "@/services/fluxoAplicacoesService";

interface EtapaCardProps {
  etapa: EtapaFormData;
  index: number;
  onUpdate: (index: number, data: Partial<EtapaFormData>) => void;
  onRemove: (index: number) => void;
}

const ORDEM_TIPOS: TipoAprovador[] = [
  "engenheiro_responsavel_cc",
  "engenheiro_solicitante",
  "aprovador_padrao_cc",
  "usuario_especifico",
  "permissao_rbac",
  "gerente_adm",
  "diretor_operacional",
  "diretor_financeiro",
  "diretor_diretoria",
];

export default function EtapaCard({ etapa, index, onUpdate, onRemove }: EtapaCardProps) {
  const sortableId = etapa.id || `new-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { data: profiles = [] } = useQuery({
    queryKey: ["fluxo-profiles-elegiveis"],
    queryFn: fetchProfilesElegiveis,
    enabled: etapa.tipo_aprovador === "usuario_especifico",
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ["fluxo-permissoes"],
    queryFn: fetchPermissoesFluxo,
    enabled: etapa.tipo_aprovador === "permissao_rbac",
  });

  const tipoOptions = useMemo(
    () => ORDEM_TIPOS.map((t) => ({ value: t, label: TIPO_APROVADOR_LABELS[t] })),
    []
  );

  const profileOptions = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: p.nome_completo || p.email || p.id,
        searchText: `${p.nome_completo ?? ""} ${p.email ?? ""}`,
      })),
    [profiles]
  );

  const permissaoOptions = useMemo(
    () =>
      permissoes.map((p) => ({
        value: p.id,
        label: p.nome ? `${p.codigo} — ${p.nome}` : p.codigo,
        searchText: `${p.codigo} ${p.nome ?? ""} ${p.modulo ?? ""}`,
      })),
    [permissoes]
  );

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Etapa {etapa.ordem}
        </span>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input
            value={etapa.nome_exibicao}
            onChange={(e) => onUpdate(index, { nome_exibicao: e.target.value })}
            placeholder="Ex: Aprovação da Obra"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nome Técnico</Label>
          <Input
            value={etapa.nome_tecnico}
            onChange={(e) => onUpdate(index, { nome_tecnico: e.target.value })}
            placeholder="Ex: aprovacao_obra"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Quem aprova</Label>
        <Combobox
          options={tipoOptions}
          value={etapa.tipo_aprovador}
          onChange={(v) =>
            onUpdate(index, {
              tipo_aprovador: v as TipoAprovador,
              // limpa vínculos incompatíveis com o novo resolvedor
              usuario_especifico_id: v === "usuario_especifico" ? etapa.usuario_especifico_id : null,
              permission_id: v === "permissao_rbac" ? etapa.permission_id : null,
            })
          }
          placeholder="Selecionar resolvedor..."
          searchPlaceholder="Buscar..."
        />
      </div>

      {etapa.tipo_aprovador === "usuario_especifico" && (
        <div className="space-y-1">
          <Label className="text-xs">Usuário aprovador *</Label>
          <Combobox
            options={profileOptions}
            value={etapa.usuario_especifico_id || ""}
            onChange={(v) => onUpdate(index, { usuario_especifico_id: v || null })}
            placeholder="Selecionar usuário..."
            searchPlaceholder="Buscar por nome ou e-mail..."
            emptyText="Nenhum usuário elegível"
          />
        </div>
      )}

      {etapa.tipo_aprovador === "permissao_rbac" && (
        <div className="space-y-1">
          <Label className="text-xs">Permissão exigida *</Label>
          <Combobox
            options={permissaoOptions}
            value={etapa.permission_id || ""}
            onChange={(v) => onUpdate(index, { permission_id: v || null })}
            placeholder="Selecionar permissão..."
            searchPlaceholder="Buscar permissão..."
            emptyText="Nenhuma permissão encontrada"
          />
          <p className="text-[11px] text-muted-foreground">
            Qualquer usuário com a ação "aprovar" nesta permissão poderá decidir a etapa.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={etapa.obrigatorio}
            onCheckedChange={(v) => onUpdate(index, { obrigatorio: v })}
          />
          <Label className="text-xs">Obrigatório</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={etapa.permite_multiplo}
            onCheckedChange={(v) => onUpdate(index, { permite_multiplo: v })}
          />
          <Label className="text-xs">Permite Múltiplos</Label>
        </div>
      </div>
    </div>
  );
}
