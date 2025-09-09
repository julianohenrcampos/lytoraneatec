import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Funcionario {
  id: string;
  nome_completo: string;
  email?: string;
  status?: string;
}

export const useFuncionarios = () => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFuncionarios = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo, email, status")
        .eq("status", "Ativo")
        .order("nome_completo", { ascending: true });

      if (error) {
        throw error;
      }

      setFuncionarios(data || []);
    } catch (error) {
      console.error("Error fetching funcionarios:", error);
      setError("Erro ao carregar funcionários");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFuncionarios();
  }, []);

  return {
    funcionarios,
    isLoading,
    error,
    refetch: fetchFuncionarios
  };
};