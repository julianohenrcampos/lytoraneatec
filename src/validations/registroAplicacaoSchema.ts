
import * as z from "zod";
import { BordoType } from "@/types/registroAplicacao";

/**
 * Zod schema for registro aplicacao form validation
 */
export const registroAplicacaoSchema = z.object({
  lista_entrega_id: z.string().uuid(),
  registro_carga_id: z.string().uuid(),
  logradouro_id: z.string().uuid().optional(),
  logradouro_aplicado: z.string().optional(),
  data_aplicacao: z.string().min(1, "Data de aplicação é obrigatória"),
  hora_chegada_local: z.string().min(1, "Hora de chegada é obrigatória"),
  temperatura_chegada: z.number().nullable().optional(),
  hora_aplicacao: z.string().optional(),
  temperatura_aplicacao: z.number().nullable().optional(),
  bordo: z.enum(["Direito", "Esquerdo", "Centro", "Único", "Embocadura"] as const).optional(),
  estaca_inicial: z.number().nullable().optional(),
  comprimento: z.number().nullable().optional(),
  largura_media: z.number().nullable().optional(),
  area_calculada: z.number().nullable().optional(),
  tonelada_aplicada: z.number().nullable().optional(),
  espessura: z.number().nullable().optional(),
  espessura_calculada: z.number().nullable().optional(),
  hora_saida_caminhao: z.string().optional(),
  estaca_final: z.number().nullable().optional(),
  anotacoes_apontador: z.string().nullable().optional(),
});

export type RegistroAplicacaoSchema = z.infer<typeof registroAplicacaoSchema>;
