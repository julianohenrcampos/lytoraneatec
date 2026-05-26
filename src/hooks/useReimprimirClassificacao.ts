import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { gerarPdfClassificacao } from "@/utils/pdf/gerarPdfClassificacao";
import { gerarPdfSolicitacaoClassificacao } from "@/utils/pdf/gerarPdfSolicitacaoClassificacao";
import { getNomeSolicitanteClassificacao } from "@/services/rh/getNomeSolicitanteClassificacao";

export const useReimprimirClassificacao = () => {
  const [isLoading, setIsLoading] = useState(false);

  const reimprimir = useCallback(async (funcionarioId: string) => {
    setIsLoading(true);
    try {
      // Último registro de classificação (qualquer tipo de evento de classificação)
      const { data: hist, error: histErr } = await supabase
        .from("bd_historico_funcional")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .in("tipo_evento", ["RECLASSIFICACAO", "PROMOCAO_PENDENTE", "PROMOCAO_EFETIVADA"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (histErr) throw histErr;
      if (!hist) {
        // Fallback Fase 2A: buscar última solicitação pendente
        const { data: solic, error: solErr } = await (supabase as any)
          .from("bd_funcionario_classificacao_solicitacoes")
          .select("id")
          .eq("funcionario_id", funcionarioId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (solErr || !solic) {
          toast.error("Nenhuma classificação registrada para reimprimir.");
          return;
        }

        // RPC SECURITY DEFINER com gate explícito (espelho da policy SELECT)
        const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
          "fn_get_classificacao_reimpressao_payload",
          { p_solicitacao_id: (solic as any).id }
        );

        if (rpcErr) {
          console.error("[CLASSIFICACAO][REIMPRESSAO_RPC_ERR]", rpcErr);
          toast.error(
            (rpcErr.message || "").toLowerCase().includes("permiss")
              ? "Sem permissão para reimprimir esta solicitação."
              : "Não foi possível carregar os dados da solicitação."
          );
          return;
        }

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!row) {
          toast.error("Sem permissão ou dados indisponíveis para reimpressão.");
          return;
        }

        console.log("[CLASSIFICACAO][REIMPRESSAO_RPC_DEBUG]", row);

        const payload = {
          protocolo_id: row.solicitacao_id,
          nome: row.nome_completo || "-",
          matricula: row.matricula ?? null,
          centro_custo: row.centro_custo_formatado || "-",
          data_admissao: row.data_admissao ?? null,
          ultima_classificacao: row.ultima_classificacao ?? null,
          cargo_atual: row.cargo_atual_nome || "-",
          salario_atual: Number(row.salario_atual ?? 0),
          novo_cargo: row.cargo_novo_nome || "-",
          novo_salario: Number(row.novo_salario ?? 0),
          motivo: row.motivo || "-",
          data_efetivacao_desejada: row.data_efetivacao_desejada ?? null,
          precisa_exame: !!row.precisa_exame,
          solicitante: row.solicitante_nome || "-",
          solicitante_email: row.solicitante_email ?? null,
          data_solicitacao: row.created_at,
        };
        console.log("[CLASSIFICACAO][PDF_PAYLOAD_DEBUG]", payload);
        gerarPdfSolicitacaoClassificacao(payload);

        toast.success("PDF de solicitação gerado.");
        return;
      }

      // Penúltimo registro (para a coluna ÚLTIMA CLASSIFICAÇÃO)
      const { data: anterior } = await supabase
        .from("bd_historico_funcional")
        .select("created_at")
        .eq("funcionario_id", funcionarioId)
        .lt("created_at", hist.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Dados do funcionário (sem embed para evitar falha silenciosa)
      const { data: f, error: fErr } = await supabase
        .from("bd_funcionarios")
        .select("nome_completo, data_admissao, centro_custo_id")
        .eq("id", funcionarioId)
        .maybeSingle();
      if (fErr) throw fErr;

      // Buscar nome do centro de custo só se necessário (fallback)
      let ccNome: string | null = null;
      if (!(hist as any).centro_custo_novo && (f as any)?.centro_custo_id) {
        const { data: cc } = await supabase
          .from("bd_centros_custo")
          .select("nome_centro_custo")
          .eq("id", (f as any).centro_custo_id)
          .maybeSingle();
        ccNome = cc?.nome_centro_custo ?? null;
      }

      const salarioAtual = Number((hist as any).salario_anterior ?? 0);
      const novoSalario = Number((hist as any).salario_novo ?? 0);
      const diff = Number((hist as any).diferenca_valor ?? novoSalario - salarioAtual);
      const pct = Number(
        (hist as any).diferenca_percentual ??
          (salarioAtual > 0 ? (diff / salarioAtual) * 100 : 0)
      );

      gerarPdfClassificacao({
        nome: f?.nome_completo || "-",
        centro_custo:
          (hist as any).centro_custo_novo ||
          ccNome ||
          "-",
        data_admissao: f?.data_admissao
          ? new Date(f.data_admissao).toLocaleDateString("pt-BR")
          : "-",
        ultima_classificacao: anterior?.created_at
          ? new Date(anterior.created_at).toLocaleDateString("pt-BR")
          : "-",
        cargo_atual: (hist as any).cargo_anterior || "-",
        salario_atual: salarioAtual,
        novo_cargo: (hist as any).cargo_novo || "-",
        novo_salario: novoSalario,
        diferenca_valor: diff,
        diferenca_percentual: pct,
        data: new Date(
          (hist as any).data_efetivacao || hist.created_at
        ).toLocaleDateString("pt-BR"),
      });

      toast.success("PDF gerado com sucesso.");
    } catch (err: any) {
      console.error("Erro ao reimprimir classificação:", err);
      toast.error(err?.message || "Erro ao reimprimir classificação");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { reimprimir, isLoading };
};
