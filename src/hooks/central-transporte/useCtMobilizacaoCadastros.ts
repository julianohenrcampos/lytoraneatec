/**
 * CT-3C R2 — Cadastros de apoio da etapa Mobilização.
 *
 * Reutiliza integralmente as estruturas existentes (nada novo é criado):
 *  - motoristas/operadores → bd_funcionarios (somente ativos);
 *  - veículos transportadores → bd_caminhoes_equipamentos (situação viável);
 *  - transportadoras terceiras → bd_empresas;
 *  - origem/destino → bd_centros_custo (situação ativa).
 *
 * Leitura pura sob RLS: o que o usuário não pode ver não aparece, e a RPC
 * revalida escopo de veículo e centro de custo na gravação.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ComboboxOption } from "@/components/ui/combobox";

const STATUS_FUNCIONARIO_ATIVO = ["Ativo", "Ativo sem Registro"];

const ordenar = (opcoes: ComboboxOption[]): ComboboxOption[] =>
  [...opcoes].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

export interface CtMobilizacaoCadastros {
  motoristas: ComboboxOption[];
  veiculos: ComboboxOption[];
  empresas: ComboboxOption[];
  centrosCusto: ComboboxOption[];
  isLoading: boolean;
}

export const useCtMobilizacaoCadastros = (enabled = true): CtMobilizacaoCadastros => {
  const motoristas = useQuery({
    enabled,
    queryKey: ["ct3c", "cadastros", "motoristas"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComboboxOption[]> => {
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, cpf, status")
        .in("status", STATUS_FUNCIONARIO_ATIVO)
        .order("nome_completo");
      if (error) throw error;
      return ordenar(
        (data ?? []).map((f) => ({
          value: f.id,
          label: f.nome_completo ?? "Sem nome",
          searchText: [f.nome_completo, f.cpf].filter(Boolean).join(" "),
        })),
      );
    },
  });

  const veiculos = useQuery({
    enabled,
    queryKey: ["ct3c", "cadastros", "veiculos-transportadores"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComboboxOption[]> => {
      const { data, error } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, frota, numero_frota, placa, modelo, situacao");
      if (error) throw error;
      const indisponiveis = ["INATIVO", "CANCELADO", "MANUTENCAO", "INDISPONIVEL"];
      return ordenar(
        (data ?? [])
          .filter((v) => !indisponiveis.includes((v.situacao ?? "").toUpperCase()))
          .map((v) => {
            const frota = [v.frota, v.numero_frota].filter(Boolean).join("-");
            return {
              value: v.id,
              label: [frota || null, v.placa].filter(Boolean).join(" · ") || "Sem identificação",
              searchText: [frota, v.placa, v.modelo].filter(Boolean).join(" "),
            };
          }),
      );
    },
  });

  const empresas = useQuery({
    enabled,
    queryKey: ["ct3c", "cadastros", "empresas-transportadoras"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComboboxOption[]> => {
      const { data, error } = await supabase
        .from("bd_empresas")
        .select("id, nome_empresa, cnpj")
        .order("nome_empresa");
      if (error) throw error;
      return ordenar(
        (data ?? []).map((e) => ({
          value: e.id,
          label: e.nome_empresa ?? "Sem nome",
          searchText: [e.nome_empresa, e.cnpj].filter(Boolean).join(" "),
        })),
      );
    },
  });

  const centrosCusto = useQuery({
    enabled,
    queryKey: ["ct3c", "cadastros", "centros-custo"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComboboxOption[]> => {
      const { data, error } = await supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo, situacao")
        .order("codigo_centro_custo");
      if (error) throw error;
      return ordenar(
        (data ?? [])
          .filter((c) => (c.situacao ?? "Ativo") !== "Inativo")
          .map((c) => ({
            value: c.id,
            label: [c.codigo_centro_custo, c.nome_centro_custo].filter(Boolean).join(" — "),
            searchText: [c.codigo_centro_custo, c.nome_centro_custo].filter(Boolean).join(" "),
          })),
      );
    },
  });

  return {
    motoristas: motoristas.data ?? [],
    veiculos: veiculos.data ?? [],
    empresas: empresas.data ?? [],
    centrosCusto: centrosCusto.data ?? [],
    isLoading:
      motoristas.isLoading || veiculos.isLoading || empresas.isLoading || centrosCusto.isLoading,
  };
};

export default useCtMobilizacaoCadastros;
