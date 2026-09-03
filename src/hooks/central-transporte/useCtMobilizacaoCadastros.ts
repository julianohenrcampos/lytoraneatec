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
import type { CcGeoMap } from "@/utils/central-transporte/autoPreencherViagem";

const STATUS_FUNCIONARIO_ATIVO = ["Ativo", "Ativo sem Registro"];

const ordenar = (opcoes: ComboboxOption[]): ComboboxOption[] =>
  [...opcoes].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

export interface CtMobilizacaoCadastros {
  motoristas: ComboboxOption[];
  veiculos: ComboboxOption[];
  empresas: ComboboxOption[];
  centrosCusto: ComboboxOption[];
  /** CT-3D — endereço cadastrado por centro de custo (null quando ausente). */
  enderecosCentroCusto: Record<string, string | null>;
  /**
   * T14/T15 — cadastro completo do CC (código, nome, endereço e coordenadas).
   * Mesmo hook, mesma leitura, mesma RLS: nenhuma segunda fonte de geolocalização.
   */
  centrosCustoPorId: CcGeoMap;
  isLoading: boolean;
}

export const useCtMobilizacaoCadastros = (enabled = true): CtMobilizacaoCadastros => {
  const motoristas = useQuery({
    enabled,
    queryKey: ["ct3c", "cadastros", "motoristas-elegiveis"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ComboboxOption[]> => {
      // Fonte viva canônica do ERP: lookup operacional de motoristas
      // (`fn_motoristas_operacional_lookup`) — já filtra função ILIKE
      // '%motorista%' e status ativo, e valida permissão server-side.
      const rpc = await (supabase as any).rpc("fn_motoristas_operacional_lookup");
      if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
        return ordenar(
          (rpc.data as any[]).map((f) => ({
            value: f.id,
            label: f.nome_completo ?? "Sem nome",
            searchText: [f.nome_completo, f.matricula, f.funcao_nome]
              .filter(Boolean)
              .join(" "),
          })),
        );
      }

      // Fallback sob RLS pela MESMA relação canônica (função → funcionário):
      // nunca lista a empresa inteira nem filtra só por texto no cliente.
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, matricula, status, bd_funcoes!inner(nome_funcao)")
        .in("status", STATUS_FUNCIONARIO_ATIVO)
        .ilike("bd_funcoes.nome_funcao", "%motorista%")
        .order("nome_completo");
      if (error) throw error;
      return ordenar(
        (data ?? []).map((f: any) => ({
          value: f.id,
          label: f.nome_completo ?? "Sem nome",
          searchText: [f.nome_completo, f.matricula, f.bd_funcoes?.nome_funcao]
            .filter(Boolean)
            .join(" "),
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
    queryFn: async (): Promise<{
      opcoes: ComboboxOption[];
      enderecos: Record<string, string | null>;
      porId: CcGeoMap;
    }> => {
      // T14/T15 — a MESMA leitura passa a trazer latitude/longitude do cadastro.
      const { data, error } = await supabase
        .from("bd_centros_custo")
        .select(
          "id, codigo_centro_custo, nome_centro_custo, situacao, endereco_completo, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, latitude, longitude",
        )
        .order("codigo_centro_custo");
      if (error) throw error;
      const ativos = (data ?? []).filter((c) => (c.situacao ?? "Ativo") !== "Inativo");
      const enderecos: Record<string, string | null> = {};
      const porId: CcGeoMap = {};
      for (const c of ativos) {
        const composto = [
          [c.endereco_rua, c.endereco_numero].filter(Boolean).join(", "),
          c.endereco_bairro,
          c.endereco_cidade,
        ]
          .filter(Boolean)
          .join(" - ");
        const endereco = (c.endereco_completo ?? "").trim() || composto.trim() || null;
        enderecos[c.id] = endereco;
        porId[c.id] = {
          id: c.id,
          codigo: c.codigo_centro_custo ?? null,
          nome: c.nome_centro_custo ?? null,
          endereco,
          latitude: c.latitude === null ? null : Number(c.latitude),
          longitude: c.longitude === null ? null : Number(c.longitude),
        };
      }
      return {
        enderecos,
        porId,
        opcoes: ordenar(
          ativos.map((c) => ({
            value: c.id,
            label: [c.codigo_centro_custo, c.nome_centro_custo].filter(Boolean).join(" — "),
            searchText: [c.codigo_centro_custo, c.nome_centro_custo].filter(Boolean).join(" "),
          })),
        ),
      };
    },
  });

  return {
    motoristas: motoristas.data ?? [],
    veiculos: veiculos.data ?? [],
    empresas: empresas.data ?? [],
    centrosCusto: centrosCusto.data?.opcoes ?? [],
    enderecosCentroCusto: centrosCusto.data?.enderecos ?? {},
    centrosCustoPorId: centrosCusto.data?.porId ?? {},
    isLoading:
      motoristas.isLoading || veiculos.isLoading || empresas.isLoading || centrosCusto.isLoading,
  };
};

export default useCtMobilizacaoCadastros;
