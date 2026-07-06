import { useMutation } from "@tanstack/react-query";
import { validarMatricula } from "@/services/atestadosService";

export function useValidarMatricula() {
  return useMutation({
    mutationFn: validarMatricula,
  });
}
