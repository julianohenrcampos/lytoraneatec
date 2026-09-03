import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  alterarAtendimentoPreferencial,
  getDepartamentosFornecedoresEquipamento,
  labelAtendimentoPreferencial,
} from "@/services/atendimentoPreferencialService";
import AtendimentoPreferencialSelect, {
  ATENDIMENTO_AVALIAR,
  resolveDepartamentoPreferencialId,
} from "./AtendimentoPreferencialSelect";

interface Props {
  solicitacaoId: string;
  departamentoAtualId: string | null | undefined;
  /** Somente apresentação: o backend é a autoridade (RBAC de planejamento). */
  podeAlterar?: boolean;
}

/**
 * Painel de direcionamento preferencial da solicitação.
 * A alteração é sempre pela RPC autoritativa (justificativa obrigatória,
 * auditoria e evento na timeline do CHI). Preferência não é autorização.
 */
const AtendimentoPreferencialPanel: React.FC<Props> = ({
  solicitacaoId,
  departamentoAtualId,
  podeAlterar = true,
}) => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = React.useState(false);
  const [valor, setValor] = React.useState(departamentoAtualId ?? ATENDIMENTO_AVALIAR);
  const [justificativa, setJustificativa] = React.useState("");

  const { data: deps = [] } = useQuery({
    queryKey: ["departamentos-fornecedores-equipamento"],
    queryFn: getDepartamentosFornecedoresEquipamento,
    staleTime: 5 * 60_000,
  });

  const nomeAtual = departamentoAtualId
    ? deps.find((d) => d.id === departamentoAtualId)?.nome ?? null
    : null;

  const mutation = useMutation({
    mutationFn: () =>
      alterarAtendimentoPreferencial(
        solicitacaoId,
        resolveDepartamentoPreferencialId(valor),
        justificativa.trim(),
      ),
    onSuccess: (res) => {
      toast.success(
        res.alterado
          ? `Atendimento preferencial alterado para ${labelAtendimentoPreferencial(
              res.departamento_atendimento_preferencial_nome,
            )}`
          : "Nenhuma alteração aplicada",
      );
      setEditando(false);
      setJustificativa("");
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-equipamento"] });
      queryClient.invalidateQueries({ queryKey: ["chamado-processo-operacional"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? "Falha ao alterar o direcionamento.";
      toast.error("Não foi possível alterar", { description: msg });
    },
  });

  const mudou = resolveDepartamentoPreferencialId(valor) !== (departamentoAtualId ?? null);

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Atendimento preferencial: </span>
          <Badge variant="outline">{labelAtendimentoPreferencial(nomeAtual)}</Badge>
        </div>
        {podeAlterar && !editando && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
            Alterar direcionamento
          </Button>
        )}
      </div>

      {editando && (
        <div className="space-y-2">
          <AtendimentoPreferencialSelect value={valor} onChange={setValor} />
          <Textarea
            placeholder="Justificativa da alteração (obrigatória, mínimo 10 caracteres)"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className="min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!mudou || justificativa.trim().length < 10 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Confirmar alteração
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditando(false);
                setValor(departamentoAtualId ?? ATENDIMENTO_AVALIAR);
                setJustificativa("");
              }}
            >
              Cancelar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O direcionamento é contexto operacional: não bloqueia o uso de ativos de outro
            departamento nem concede autorização.
          </p>
        </div>
      )}
    </div>
  );
};

export default AtendimentoPreferencialPanel;
