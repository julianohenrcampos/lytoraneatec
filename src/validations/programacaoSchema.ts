
import { z } from "zod";

export const itemSchema = z.object({
  id: z.string().optional(),
  requisicao_id: z.string().optional(),
  centro_custo_nome: z.string().optional(),
  logradouro: z.string().optional(),
  caminhao_id: z.string().optional(),
  tipo_lancamento: z.string().optional(),
  equipe_id: z.string().optional(),
  apontador_id: z.string().optional(),
  usina_id: z.string().optional(),
  data_entrega: z.string().min(1, "Data de entrega é obrigatória").optional(),
  status: z.enum(['Pendente', 'Enviada', 'Cancelada', 'Entregue']).optional(),
  cancelled: z.boolean().optional(),
  cancelReason: z.string().optional(),
  quantidade_massa: z.number().min(0.01, "Quantidade deve ser maior que zero"),
});

export const programacaoSchema = z.object({
  requisicao_id: z.string().min(1, "Requisição é obrigatória"),
  centro_custo_id: z.string().optional(),
  data_entrega: z.string().min(1, "Data de entrega é obrigatória"),
  ruas: z.array(z.object({
    logradouro: z.string().optional(),
    area: z.number().optional(),
    volume: z.number().optional(),
  })).optional(),
  itens: z.array(itemSchema).optional(),
});

export type ProgramacaoFormValues = z.infer<typeof programacaoSchema>;
export type ItemFormValues = z.infer<typeof itemSchema>;
