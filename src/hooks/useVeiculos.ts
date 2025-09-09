import { useState, useEffect } from "react";
import { getTrucksForSelection, TruckForSelection } from "@/services/veiculo/getTrucksForSelection";

export const useVeiculos = () => {
  const [veiculos, setVeiculos] = useState<TruckForSelection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVeiculos = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getTrucksForSelection();
      setVeiculos(data);
    } catch (error) {
      console.error("Error fetching veiculos:", error);
      setError("Erro ao carregar veículos");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVeiculos();
  }, []);

  return {
    veiculos,
    isLoading,
    error,
    refetch: fetchVeiculos
  };
};