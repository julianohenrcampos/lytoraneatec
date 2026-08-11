/**
 * CT-3E.2 — funcionários que possuem usuário do sistema.
 *
 * Serve apenas para avisar no planejamento que o recebedor escolhido não
 * conseguirá confirmar o recebimento pelo aplicativo. A decisão de acesso
 * continua sendo do servidor.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCtFuncionariosComUsuario = (enabled = true) => {
  const query = useQuery({
    enabled,
    queryKey: ["ct3e", "funcionarios-com-usuario"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "fn_ct_funcionarios_com_usuario",
        {},
      );

      if (error) throw error;
      const ids = (data as { funcionario_ids?: unknown } | null)?.funcionario_ids;
      return new Set(Array.isArray(ids) ? (ids as string[]) : []);
    },
  });
  return {
    isLoading: query.isLoading,
    comUsuario: query.data ?? null,
  };
};

export default useCtFuncionariosComUsuario;
