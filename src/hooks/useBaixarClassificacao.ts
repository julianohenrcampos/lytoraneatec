import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Funcionario } from "@/types/funcionario";
import { gerarPdfClassificacao } from "@/utils/pdf/gerarPdfClassificacao";

export interface ClassificacaoPayload {
  funcionario: Funcionario;
  novo_cargo_id: string;
  novo_cargo_nome: string;
  novo_salario: number;
  motivo: string;
  data_efetivacao: string; // YYYY-MM-DD
}

export const PENDING_HISTORICO_KEY = "lyto:pendingClassificacao";

export const useBaixarClassificacao = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUltimaClassificacao = useCallback(
    async (funcionarioId: string): Promise<string | null> => {
      const { data } = await supabase
        .from("bd_historico_funcional")
        .select("created_at")
        .eq("funcionario_id", funcionarioId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.created_at) return null;
      return new Date(data.created_at).toLocaleDateString("pt-BR");
    },
    []
  );

  const salvar = useCallback(
    async (payload: ClassificacaoPayload, precisaExame: boolean) => {
      setIsSubmitting(true);
      try {
        const f = payload.funcionario;
        const salario_atual = Number(f.salario_base ?? 0);
        const novo_salario = Number(payload.novo_salario ?? 0);
        const diferenca_valor = novo_salario - salario_atual;
        const diferenca_percentual =
          salario_atual > 0
            ? ((novo_salario - salario_atual) / salario_atual) * 100
            : 0;

        const cargo_anterior = f.bd_funcoes?.nome_funcao || null;
        const centro_custo_atual = f.bd_centros_custo?.nome_centro_custo || null;

        const baseInsert = {
          funcionario_id: f.id,
          cargo_anterior,
          cargo_novo: payload.novo_cargo_nome,
          cargo_novo_id: payload.novo_cargo_id,
          salario_anterior: salario_atual,
          salario_novo: novo_salario,
          centro_custo_anterior: centro_custo_atual,
          centro_custo_novo: centro_custo_atual,
          motivo: payload.motivo,
          diferenca_valor,
          diferenca_percentual,
          percentual_aumento: diferenca_percentual,
          precisa_exame: precisaExame,
        };

        if (!precisaExame) {
          // Caminho direto
          const { error: histErr } = await supabase
            .from("bd_historico_funcional")
            .insert({
              ...baseInsert,
              tipo_evento: "RECLASSIFICACAO",
              data_efetivacao: payload.data_efetivacao,
            });
          if (histErr) throw histErr;

          const { error: updErr } = await supabase
            .from("bd_funcionarios")
            .update({
              funcao_id: payload.novo_cargo_id,
              salario_base: novo_salario,
            })
            .eq("id", f.id);
          if (updErr) throw updErr;

          // PDF
          gerarPdfClassificacao({
            nome: f.nome_completo,
            centro_custo: centro_custo_atual || "-",
            data_admissao: f.data_admissao
              ? new Date(f.data_admissao).toLocaleDateString("pt-BR")
              : "-",
            ultima_classificacao:
              (await fetchUltimaClassificacao(f.id)) || "-",
            cargo_atual: cargo_anterior || "-",
            salario_atual,
            novo_cargo: payload.novo_cargo_nome,
            novo_salario,
            diferenca_valor,
            diferenca_percentual,
            data: new Date(payload.data_efetivacao).toLocaleDateString("pt-BR"),
          });

          toast.success("Classificação aplicada com sucesso");
          queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
          return { ok: true, redirected: false };
        }

        // Caminho com exame: insere PROMOCAO_PENDENTE e navega
        const { data: hist, error: histErr } = await supabase
          .from("bd_historico_funcional")
          .insert({
            ...baseInsert,
            tipo_evento: "PROMOCAO_PENDENTE",
          })
          .select("id")
          .single();
        if (histErr) throw histErr;

        // Persistir vínculo pendente para a página de Agendamento de Exames
        sessionStorage.setItem(
          PENDING_HISTORICO_KEY,
          JSON.stringify({
            historico_id: hist.id,
            funcionario_id: f.id,
            funcao_nova_id: payload.novo_cargo_id,
            motivo: payload.motivo,
          })
        );

        toast.success("Histórico criado. Redirecionando para agendamento...");

        navigate("/sso/agendamento-exames", {
          state: {
            origem: "classificacao",
            tipo_exame: "Mudança de Risco",
            funcionario_id: f.id,
            funcao_nova_id: payload.novo_cargo_id,
            motivo_mudanca_risco: payload.motivo,
            historico_id: hist.id,
            funcionario_payload: {
              id: f.id,
              nome: f.nome_completo,
              nome_completo: f.nome_completo,
              cpf: f.cpf || "",
              rg: (f as any).rg || "",
              data_nascimento: f.data_nascimento || "",
              telefone: (f as any).telefone || "",
              email: (f as any).email || "",
              funcao: cargo_anterior || "",
              empresa: (f as any).bd_empresas?.nome_empresa || "",
              contrato: centro_custo_atual || "",
              endereco_rua: (f as any).endereco_rua || "",
              endereco_numero: (f as any).endereco_numero || "",
              endereco_bairro: (f as any).endereco_bairro || "",
              endereco_cidade: (f as any).endereco_cidade || "",
              endereco_estado: (f as any).endereco_estado || "",
              endereco_cep: (f as any).endereco_cep || "",
            },
          },
        });

        return { ok: true, redirected: true };
      } catch (err: any) {
        console.error("Erro em baixar classificação:", err);
        toast.error(err?.message || "Erro ao salvar classificação");
        return { ok: false, redirected: false };
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, queryClient, fetchUltimaClassificacao]
  );

  return { salvar, isSubmitting, fetchUltimaClassificacao };
};
