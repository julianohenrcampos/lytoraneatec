import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useExcluirUltimaClassificacao = () => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const excluir = useCallback(
    async (funcionarioId: string) => {
      setIsLoading(true);
      try {
        const { data: hist, error: histErr } = await supabase
          .from("bd_historico_funcional")
          .select("*")
          .eq("funcionario_id", funcionarioId)
          .in("tipo_evento", [
            "RECLASSIFICACAO",
            "PROMOCAO_PENDENTE",
            "PROMOCAO_EFETIVADA",
          ])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (histErr) throw histErr;
        if (!hist) {
          toast.error("Nenhuma classificação para excluir.");
          return { ok: false };
        }

        // Reverter funcionário se já efetivada
        if (
          hist.tipo_evento === "RECLASSIFICACAO" ||
          hist.tipo_evento === "PROMOCAO_EFETIVADA"
        ) {
          // Buscar funcao_id do cargo anterior pelo nome (best-effort)
          let funcaoAnteriorId: string | null = null;
          if ((hist as any).cargo_anterior) {
            const { data: fn } = await supabase
              .from("bd_funcoes")
              .select("id")
              .eq("nome_funcao", (hist as any).cargo_anterior)
              .maybeSingle();
            funcaoAnteriorId = fn?.id || null;
          }

          const updatePayload: Record<string, any> = {
            salario_base: Number((hist as any).salario_anterior ?? 0),
          };
          if (funcaoAnteriorId) updatePayload.funcao_id = funcaoAnteriorId;

          const { error: updErr } = await supabase
            .from("bd_funcionarios")
            .update(updatePayload)
            .eq("id", funcionarioId);
          if (updErr) throw updErr;
        }

        const { error: delErr } = await supabase
          .from("bd_historico_funcional")
          .delete()
          .eq("id", hist.id);
        if (delErr) throw delErr;

        toast.success("Classificação excluída com sucesso.");
        queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
        return { ok: true };
      } catch (err: any) {
        console.error("Erro ao excluir classificação:", err);
        toast.error(err?.message || "Erro ao excluir classificação");
        return { ok: false };
      } finally {
        setIsLoading(false);
      }
    },
    [queryClient]
  );

  return { excluir, isLoading };
};
