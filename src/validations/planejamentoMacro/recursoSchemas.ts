import { z } from "zod";

const numeroPositivoFinito = (label: string) =>
  z
    .number({ invalid_type_error: `${label} deve ser numérico` })
    .finite(`${label} inválido`);

const numNaoNegativoOpcional = (label: string) =>
  numeroPositivoFinito(label)
    .min(0, `${label} não pode ser negativo`)
    .nullable()
    .optional();

export const maoObraInsertSchema = z
  .object({
    planejamento_id: z.string().uuid("planejamento_id inválido"),
    atividade_id: z.string().uuid("atividade_id inválido"),
    funcao_id: z.string().uuid("Selecione uma função"),
    descricao: z
      .string()
      .trim()
      .min(1, "Descrição da função é obrigatória")
      .max(200, "Descrição muito longa"),
    quantidade_prevista: numeroPositivoFinito("Quantidade prevista").gt(
      0,
      "Quantidade deve ser maior que 0"
    ),
    horas_previstas: numNaoNegativoOpcional("Horas previstas"),
    dias_previstos: numNaoNegativoOpcional("Dias previstos"),
    unidade: z.string().trim().max(20).nullable().optional(),
    observacao: z
      .string()
      .trim()
      .max(500, "Observação muito longa")
      .nullable()
      .optional(),
  })
  .refine(
    (v) =>
      (v.horas_previstas !== null && v.horas_previstas !== undefined) ||
      (v.dias_previstos !== null && v.dias_previstos !== undefined),
    {
      message: "Informe ao menos horas previstas ou dias previstos",
      path: ["horas_previstas"],
    }
  );

export type MaoObraInsertInput = z.infer<typeof maoObraInsertSchema>;

export const maoObraUpdateSchema = z
  .object({
    quantidade_prevista: numeroPositivoFinito("Quantidade prevista")
      .gt(0, "Quantidade deve ser maior que 0")
      .optional(),
    horas_previstas: numNaoNegativoOpcional("Horas previstas"),
    dias_previstos: numNaoNegativoOpcional("Dias previstos"),
    unidade: z.string().trim().max(20).nullable().optional(),
    observacao: z
      .string()
      .trim()
      .max(500, "Observação muito longa")
      .nullable()
      .optional(),
  });

export type MaoObraUpdateInput = z.infer<typeof maoObraUpdateSchema>;
