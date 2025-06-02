
import { useState, useEffect } from "react";
import { fetchLogradourosByRequisicao } from "@/services/logradourosService";
import { useToast } from "@/hooks/use-toast";

interface LogradouroOption {
  id: string;
  logradouro: string;
  requisicao_id: string;
}

export const useLogradourosByRequisicao = (requisicaoId?: string) => {
  const [logradouros, setLogradouros] = useState<LogradouroOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!requisicaoId) {
      setLogradouros([]);
      return;
    }

    const loadLogradouros = async () => {
      setIsLoading(true);
      try {
        console.log("🗺️ Fetching logradouros for requisicao:", requisicaoId);
        const data = await fetchLogradourosByRequisicao(requisicaoId);
        setLogradouros(data);
        console.log("✅ Loaded logradouros:", data.length);
      } catch (error) {
        console.error("❌ Error loading logradouros:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os logradouros da requisição",
          variant: "destructive",
        });
        setLogradouros([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLogradouros();
  }, [requisicaoId, toast]);

  return { logradouros, isLoading };
};
