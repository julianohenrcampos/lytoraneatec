
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFuncionarioEquipe(funcionarioId?: string) {
  return useQuery({
    queryKey: ['funcionario-equipe', funcionarioId],
    queryFn: async () => {
      if (!funcionarioId) return null;
      
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select(`
          equipe_id,
          bd_equipes:equipe_id(nome_equipe)
        `)
        .eq("id", funcionarioId)
        .single();
        
      if (error) {
        console.error("Erro ao buscar equipe do funcionário:", error);
        return null;
      }
      
      // Verificar se bd_equipes é um objeto válido e tem nome_equipe
      return data?.bd_equipes && typeof data.bd_equipes === 'object' && 'nome_equipe' in data.bd_equipes
        ? data.bd_equipes.nome_equipe 
        : null;
    },
    enabled: !!funcionarioId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
