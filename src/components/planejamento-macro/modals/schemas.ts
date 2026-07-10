import { z } from "zod";

export const planejamentoFormSchema = z
  .object({
    centro_custo_id: z.string().uuid({ message: "Centro de Custo obrigatório." }),
    periodo_inicio: z.string().min(1, "Data inicial obrigatória."),
    periodo_fim: z.string().min(1, "Data final obrigatória."),
    versao: z.coerce.number().int().min(1, "Versão deve ser >= 1"),
    status: z.enum(["rascunho", "vigente", "arquivado"]),
    observacao: z
      .string()
      .trim()
      .max(500, "Máximo de 500 caracteres.")
      .optional()
      .or(z.literal("")),
  })
  .refine((d) => d.periodo_fim >= d.periodo_inicio, {
    path: ["periodo_fim"],
    message: "A data final deve ser maior ou igual à data inicial.",
  });

export type PlanejamentoFormValues = z.infer<typeof planejamentoFormSchema>;

// Fase 6G — Edição individual de atividade planejada (SuperAdm).
// Datas em YYYY-MM-DD; nunca usar new Date("YYYY-MM-DD").
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().max(max).nullable().optional()
  );

const optionalNonNegativeNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z
    .number({ invalid_type_error: "Valor numérico inválido." })
    .min(0, "Valor deve ser >= 0.")
    .nullable()
    .optional()
);

const optionalNonNegativeInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z
    .number({ invalid_type_error: "Valor numérico inválido." })
    .int("Deve ser inteiro.")
    .min(0, "Valor deve ser >= 0.")
    .nullable()
    .optional()
);

export const atividadeEditSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome é obrigatório.").max(255),
    codigo_wbs: optionalTrimmedString(50),
    descricao: optionalTrimmedString(2000),
    frente_servico: optionalTrimmedString(120),
    data_inicio: z
      .string()
      .regex(ISO_DATE, "Data de início obrigatória (YYYY-MM-DD)."),
    data_fim: z
      .string()
      .regex(ISO_DATE, "Data de fim obrigatória (YYYY-MM-DD)."),
    unidade: optionalTrimmedString(20),
    quantidade_prevista: optionalNonNegativeNumber,
    producao_prevista: optionalNonNegativeNumber,
    prioridade: z.enum(["baixa", "media", "alta"]),
    status: z.enum([
      "planejada",
      "em_andamento",
      "concluida",
      "atrasada",
      "cancelada",
    ]),
    ordem_execucao: optionalNonNegativeInt,
  })
  .superRefine((data, ctx) => {
    if (data.data_fim < data.data_inicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data_fim"],
        message: "A data final deve ser maior ou igual à data inicial.",
      });
    }
    const hasQtd =
      data.quantidade_prevista != null || data.producao_prevista != null;
    const unidadeVazia = !data.unidade || data.unidade.trim() === "";
    if (hasQtd && unidadeVazia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unidade"],
        message:
          "Unidade de medida é obrigatória quando há quantidade ou produção prevista.",
      });
    }
  });

export type AtividadeEditValues = z.infer<typeof atividadeEditSchema>;
