// Fase 7B — Mão de obra alocada no Centro de Custo na semana selecionada.
//
// Fonte do vínculo CC (decisão documentada):
// ------------------------------------------
// `bd_historico_funcional` armazena EVENTOS pontuais (admissão, transferência,
// promoção, etc.) com `data_efetivacao`, `centro_custo_anterior` e
// `centro_custo_novo` — NÃO há colunas `data_inicio`/`data_fim` formando um
// intervalo de vínculo a um CC. Reconstruir o estado vigente por semana
// exigiria varrer o histórico ordenado por funcionário para projetar o CC
// atual em cada data — escopo além desta fase.
//
// Por isso, esta fase usa `bd_funcionarios.centro_custo_id` (estado atual) como
// proxy do vínculo vigente na semana, filtrando por status ATIVO. É preciso
// (não exato) para semanas passadas/futuras distantes; suficiente para
// validação operacional da semana corrente, que é o uso primário.
//
// Quando o histórico ganhar colunas de intervalo (ou for criada a tabela de
// vínculos), trocar a fonte sem mudar a interface do hook.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlocadoNoCC {
  funcaoChave: string; // UPPER(TRIM(nome_funcao))
  funcaoId: string | null;
  funcaoNome: string;
  alocados: number;
}

// Memo "Active Employee Restriction"
const STATUS_ATIVOS = new Set(["ATIVO", "ATIVO SEM REGISTRO"]);

interface Params {
  centroCustoId: string | null;
  semanaInicio: string | null;
  semanaFim: string | null;
}

export function useMaoObraAlocadaNoCC({ centroCustoId, semanaInicio, semanaFim }: Params) {
  return useQuery({
    queryKey: ["plano-semanal-mo-alocada", centroCustoId, semanaInicio, semanaFim],
    enabled: !!centroCustoId,
    staleTime: 60_000,
    queryFn: async (): Promise<Map<string, AlocadoNoCC>> => {
      const { data, error } = await (supabase as any)
        .from("bd_funcionarios")
        .select("id, status, funcao_id, bd_funcoes:bd_funcoes(id, nome_funcao)")
        .eq("centro_custo_id", centroCustoId);
      if (error) throw error;

      const mapa = new Map<string, AlocadoNoCC>();
      for (const f of (data ?? []) as any[]) {
        const status = (f.status ?? "").toString().trim().toUpperCase();
        if (!STATUS_ATIVOS.has(status)) continue;
        const funcao = f.bd_funcoes;
        const nome = (funcao?.nome_funcao ?? "").toString();
        const chave = nome.trim().toUpperCase().replace(/\s+/g, " ");
        if (!chave) continue;
        const atual = mapa.get(chave);
        if (atual) {
          atual.alocados += 1;
        } else {
          mapa.set(chave, {
            funcaoChave: chave,
            funcaoId: funcao?.id ?? null,
            funcaoNome: nome,
            alocados: 1,
          });
        }
      }
      return mapa;
    },
  });
}
