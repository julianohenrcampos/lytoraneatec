
import { z } from "zod";

export const apontamentoEquipeSchema = z.object({
  equipe_id: z.string().min(1, "Equipe é obrigatória"),
  data_registro: z.date(),
  lista_entrega_id: z.string().optional(),
  colaboradores: z.array(z.object({
    colaborador_id: z.string(),
    nome_colaborador: z.string(),
    presente: z.boolean(),
    hora_inicio: z.string().optional(),
    hora_fim: z.string().optional(),
  }))
});

export type ApontamentoEquipeSchema = z.infer<typeof apontamentoEquipeSchema>;
