import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  atualizarDispositivo,
  criarDispositivo,
  definirSenhaDispositivo,
  DispositivoUpsertInput,
  listarDispositivos,
  listarTodosVinculosAtivos,
  listarVinculosDispositivo,
  toggleAtivoDispositivo,
  vincularCcsDispositivo,
} from "@/services/pontoDispositivosService";
import { useToast } from "@/hooks/use-toast";

const KEY = ["ponto-dispositivos-admin"];
const VINC_KEY = ["ponto-dispositivos-vinculos"];

export function usePontoDispositivos() {
  return useQuery({
    queryKey: KEY,
    queryFn: listarDispositivos,
  });
}

export function useTodosVinculosAtivos() {
  return useQuery({
    queryKey: [...VINC_KEY, "todos"],
    queryFn: listarTodosVinculosAtivos,
  });
}

export function useVinculosDispositivo(dispositivoId: string | undefined) {
  return useQuery({
    queryKey: [...VINC_KEY, dispositivoId],
    queryFn: () => listarVinculosDispositivo(dispositivoId!),
    enabled: !!dispositivoId,
  });
}

export function useSalvarDispositivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (params: {
      input: DispositivoUpsertInput;
      centro_custo_ids: string[];
    }) => {
      const { input, centro_custo_ids } = params;
      const ccPrincipal = centro_custo_ids[0];
      let id = input.id;
      if (id) {
        await atualizarDispositivo(input, ccPrincipal);
      } else {
        const created = await criarDispositivo(input, ccPrincipal);
        id = created.id as string;
      }
      await vincularCcsDispositivo(id!, centro_custo_ids);
      return id!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: VINC_KEY });
      toast({ title: "Dispositivo salvo" });
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Erro ao salvar";
      const codigoDup = /uq_disp_codigo|duplicate key/.test(msg);
      toast({
        title: "Erro",
        description: codigoDup ? "Código já em uso" : msg,
        variant: "destructive",
      });
    },
  });
}

export function useToggleAtivo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      toggleAtivoDispositivo(id, ativo),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({
        title: vars.ativo ? "Dispositivo ativado" : "Dispositivo desativado",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao alterar status",
        variant: "destructive",
      }),
  });
}

export function useDefinirSenha() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, senha }: { id: string; senha: string }) =>
      definirSenhaDispositivo(id, senha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast({ title: "Senha definida com sucesso" });
    },
    onError: (e: any) =>
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao definir senha",
        variant: "destructive",
      }),
  });
}
