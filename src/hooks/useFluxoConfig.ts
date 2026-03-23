import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import * as service from "@/services/fluxoAprovacaoConfigService";
import type { FluxoFormData, EtapaFormData } from "@/types/fluxoAprovacao";

const FLUXOS_KEY = ["fluxos"];

export function useFluxos() {
  return useQuery({
    queryKey: FLUXOS_KEY,
    queryFn: service.fetchFluxos,
  });
}

export function useFluxo(id: string | null) {
  return useQuery({
    queryKey: ["fluxo", id],
    queryFn: () => service.fetchFluxo(id!),
    enabled: !!id,
  });
}

export function useEtapas(fluxoId: string | null) {
  return useQuery({
    queryKey: ["fluxo-etapas", fluxoId],
    queryFn: () => service.fetchEtapas(fluxoId!),
    enabled: !!fluxoId,
  });
}

export function useVinculacoes(fluxoId: string | null) {
  return useQuery({
    queryKey: ["fluxo-vinculacoes", fluxoId],
    queryFn: () => service.fetchVinculacoes(fluxoId!),
    enabled: !!fluxoId,
  });
}

export function useCreateFluxo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: FluxoFormData) => service.createFluxo(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FLUXOS_KEY });
      toast({ title: "Fluxo criado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar fluxo", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateFluxo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FluxoFormData }) => service.updateFluxo(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FLUXOS_KEY });
      toast({ title: "Fluxo atualizado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteFluxo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => service.deleteFluxo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FLUXOS_KEY });
      toast({ title: "Fluxo excluído" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });
}

export function useDuplicarFluxo() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => service.duplicarFluxo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FLUXOS_KEY });
      toast({ title: "Fluxo duplicado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
  });
}

export function useSaveEtapas() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ fluxoId, etapas }: { fluxoId: string; etapas: EtapaFormData[] }) =>
      service.saveEtapas(fluxoId, etapas),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["fluxo-etapas", vars.fluxoId] });
      qc.invalidateQueries({ queryKey: FLUXOS_KEY });
      toast({ title: "Etapas salvas com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar etapas", description: e.message, variant: "destructive" }),
  });
}

export function useSaveVinculacoes() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ fluxoId, ccIds }: { fluxoId: string; ccIds: string[] }) =>
      service.saveVinculacoes(fluxoId, ccIds),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["fluxo-vinculacoes", vars.fluxoId] });
      qc.invalidateQueries({ queryKey: FLUXOS_KEY });
      toast({ title: "Vinculações salvas com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar vinculações", description: e.message, variant: "destructive" }),
  });
}
