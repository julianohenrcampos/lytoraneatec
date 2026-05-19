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
          .select("id, cargo_atual_nome, cargo_novo_nome, motivo, data_efetivacao_desejada, precisa_exame, created_at, solicitado_por")
          .eq("funcionario_id", funcionarioId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (solErr || !solic) {
          toast.error("Nenhuma classificação registrada para reimprimir.");
          return;
        }

        const { data: fSol } = await supabase
          .from("bd_funcionarios")
          .select("nome_completo, matricula, data_admissao, bd_centros_custo(nome_centro_custo)")
          .eq("id", funcionarioId)
          .maybeSingle();

        let solicitanteNome = "-";
        let solicitanteEmail: string | null = null;
        if ((solic as any).solicitado_por) {
          const info = await getNomeSolicitanteClassificacao(
            (solic as any).solicitado_por,
            { usarMetadataDoAuth: false }
          );
          solicitanteNome = info.nome;
          solicitanteEmail = info.email;
        } else {
          console.warn("[NOVA_CLASSIFICACAO][SOLICITANTE_NAO_ENCONTRADO]", {
            solicitacao_id: (solic as any).id,
          });
        }

        gerarPdfSolicitacaoClassificacao({
          protocolo_id: (solic as any).id,
          nome: (fSol as any)?.nome_completo || "-",
          matricula: (fSol as any)?.matricula ?? null,
          centro_custo: (fSol as any)?.bd_centros_custo?.nome_centro_custo || "-",
          data_admissao: (fSol as any)?.data_admissao ?? null,
          cargo_atual: (solic as any).cargo_atual_nome || "-",
          novo_cargo: (solic as any).cargo_novo_nome || "-",
          motivo: (solic as any).motivo || "-",
          data_efetivacao_desejada: (solic as any).data_efetivacao_desejada ?? null,
          precisa_exame: !!(solic as any).precisa_exame,
          solicitante: solicitanteNome,
          solicitante_email: solicitanteEmail,
          data_solicitacao: (solic as any).created_at,
        });

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
