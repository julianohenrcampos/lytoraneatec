import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useEnviarAtestado,
  type EtapaEnvio,
} from "@/hooks/atestados/useEnviarAtestado";
import type { AtestadoSubmeterResponse } from "@/types/atestadoMedico";
import {
  SISTEMAS_AFETADOS,
  SISTEMAS_AFETADOS_CODIGOS,
  SISTEMA_OUTROS_CODIGO,
} from "@/constants/atestadosSistemasAfetados";
import {
  TIPOS_DOCUMENTO,
  TIPOS_DOCUMENTO_CODIGOS,
  TIPO_ATESTADO_MEDICO,
  tipoExigeSistemaAfetado,
} from "@/constants/atestadosTiposDocumento";

interface Props {
  tokenValidacao: string;
  funcionarioNome: string;
  funcionarioMatricula: string;
  onEnviado: (resp: AtestadoSubmeterResponse, diasAfastamento: number) => void;
  onTokenInvalido: () => void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const EXTS = ["pdf", "jpg", "jpeg", "png"];
const MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const hoje = () => new Date().toISOString().slice(0, 10);

const schema = z
  .object({
    tipo_documento: z
      .string()
      .refine((v) => TIPOS_DOCUMENTO_CODIGOS.includes(v), {
        message: "Selecione um tipo de documento válido",
      }),
    sistema_afetado_codigo: z.string().optional(),
    sistema_afetado_observacao: z.string().optional(),
    data_inicio_afastamento: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
      .refine((v) => v <= hoje(), "Data não pode ser futura"),
    dias_afastamento: z
      .number({ invalid_type_error: "Informe os dias" })
      .int("Somente números inteiros")
      .min(1, "Mínimo 1 dia")
      .max(365, "Máximo 365 dias"),
    declaracao_veracidade: z.literal(true, {
      errorMap: () => ({ message: "Obrigatório" }),
    }),
    declaracao_original_48h: z.literal(true, {
      errorMap: () => ({ message: "Obrigatório" }),
    }),
    declaracao_ciencia_nao_validacao: z.literal(true, {
      errorMap: () => ({ message: "Obrigatório" }),
    }),
  })
  .superRefine((v, ctx) => {
    if (!tipoExigeSistemaAfetado(v.tipo_documento)) return;
    if (!SISTEMAS_AFETADOS_CODIGOS.includes(v.sistema_afetado_codigo || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sistema_afetado_codigo"],
        message: "Selecione o sistema afetado",
      });
      return;
    }
    if (v.sistema_afetado_codigo === SISTEMA_OUTROS_CODIGO) {
      const obs = (v.sistema_afetado_observacao || "").trim();
      if (obs.length < 3 || obs.length > 2000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sistema_afetado_observacao"],
          message: "Informe entre 3 e 2000 caracteres",
        });
      }
    }
  });

export default function EtapaFormularioAtestado({
  tokenValidacao,
  funcionarioNome,
  funcionarioMatricula,
  onEnviado,
  onTokenInvalido,
}: Props) {
  const dataRegistro = useMemo(() => hoje(), []);
  const [tipoDocumento, setTipoDocumento] = useState<string>(TIPO_ATESTADO_MEDICO);
  const [sistemaCodigo, setSistemaCodigo] = useState<string>("");
  const [sistemaObs, setSistemaObs] = useState<string>("");
  const [dataInicio, setDataInicio] = useState("");
  const [dias, setDias] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [decV, setDecV] = useState(false);
  const [decO, setDecO] = useState(false);
  const [decC, setDecC] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [etapaEnvio, setEtapaEnvio] = useState<EtapaEnvio | null>(null);
  const enviar = useEnviarAtestado();

  const isAtestado = tipoExigeSistemaAfetado(tipoDocumento);
  const rotuloDoc = isAtestado ? "atestado" : "documento";

  const rotuloEtapa =
    etapaEnvio === "preparando"
      ? "Preparando envio…"
      : etapaEnvio === "enviando_arquivo"
      ? "Enviando arquivo…"
      : etapaEnvio === "registrando"
      ? `Registrando ${rotuloDoc}…`
      : `Enviar ${rotuloDoc}`;

  const precisaObservacao =
    isAtestado && sistemaCodigo === SISTEMA_OUTROS_CODIGO;

  function validarArquivo(f: File | null): string | null {
    if (!f) return "Selecione o arquivo do atestado";
    if (f.size > MAX_BYTES) return "Arquivo maior que 10 MB";
    const ponto = f.name.lastIndexOf(".");
    const ext = ponto >= 0 ? f.name.slice(ponto + 1).toLowerCase() : "";
    if (!EXTS.includes(ext)) return "Somente PDF, JPG ou PNG";
    if (f.type && !MIMES.has(f.type)) return "Tipo de arquivo não suportado";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      tipo_documento: tipoDocumento,
      sistema_afetado_codigo: isAtestado ? sistemaCodigo : undefined,
      sistema_afetado_observacao: isAtestado ? sistemaObs : undefined,
      data_inicio_afastamento: dataInicio,
      dias_afastamento: Number(dias),
      declaracao_veracidade: decV,
      declaracao_original_48h: decO,
      declaracao_ciencia_nao_validacao: decC,
    });
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
    }
    const arquivoErr = validarArquivo(file);
    if (arquivoErr) errs.arquivo = arquivoErr;
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      const resp = await enviar.mutateAsync({
        onEtapa: setEtapaEnvio,
        token_validacao: tokenValidacao,
        file: file!,
        data_emissao: dataRegistro,
        data_inicio_afastamento: dataInicio,
        dias_afastamento: Number(dias),
        tipo_documento: tipoDocumento,
        sistema_afetado_codigo: isAtestado ? sistemaCodigo : undefined,
        sistema_afetado_observacao: precisaObservacao
          ? sistemaObs.trim()
          : undefined,
      });
      onEnviado(resp, Number(dias));
    } catch (e: any) {
      const code = e?.code || "";
      if (code === "token_invalido" || code === "token_ja_utilizado") {
        toast.error(
          "Sua sessão de validação expirou durante o envio. Refaça a validação e envie novamente.",
        );
        onTokenInvalido();
      } else if (code === "timeout" || code === "network_error") {
        toast.error(
          "A conexão demorou demais. Verifique sua internet e tente novamente.",
        );
      } else if (code === "limite_acompanhamento_filho") {
        toast.error(
          "O limite de envio para acompanhamento de filho já foi utilizado no período permitido. Para orientações e análise da situação, procure o Setor de Saúde.",
          { duration: 10000 },
        );
      } else if (code === "limite_acompanhamento_esposa_gestante") {
        toast.error(
          "O limite de acompanhamentos previstos para esposa gestante já foi atingido. Para esclarecimentos, entre em contato com o Setor de Saúde.",
          { duration: 10000 },
        );
      } else if (code === "tipo_documento_invalido") {
        toast.error("Selecione um tipo de documento válido.");
      } else if (
        code === "invalid_input" ||
        code === "declaracoes_obrigatorias" ||
        code === "sistema_afetado_invalido" ||
        code === "sistema_afetado_observacao_obrigatoria" ||
        code === "sistema_afetado_observacao_invalida"
      ) {
        toast.error("Verifique os campos e tente novamente.");
      } else if (code === "arquivo_extensao_invalida") {
        setErrors((prev) => ({ ...prev, arquivo: "Extensão não permitida" }));
      } else if (code === "upload_failed") {
        toast.error("Falha ao enviar o arquivo. Tente novamente.");
      } else {
        toast.error("Não foi possível enviar. Tente novamente.");
      }
    } finally {
      setEtapaEnvio(null);
    }
  }

  const mask = (s: string) =>
    s.length <= 3 ? s : `${s.slice(0, 2)}${"*".repeat(Math.max(0, s.length - 3))}${s.slice(-1)}`;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 p-3 rounded-md bg-muted/50 text-sm">
          <div className="font-medium text-foreground">{funcionarioNome}</div>
          <div className="text-muted-foreground">Matrícula: {mask(funcionarioMatricula)}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="tipo_documento">Tipo de documento</Label>
            <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
              <SelectTrigger id="tipo_documento">
                <SelectValue placeholder="Selecione o tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t.codigo} value={t.codigo}>
                    {t.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tipo_documento && (
              <p className="text-xs text-destructive">{errors.tipo_documento}</p>
            )}
          </div>

          {isAtestado && (
          <div className="space-y-2">
            <Label htmlFor="sistema_afetado">Sistema afetado</Label>
            <Select value={sistemaCodigo} onValueChange={setSistemaCodigo}>
              <SelectTrigger id="sistema_afetado">
                <SelectValue placeholder="Selecione o sistema afetado" />
              </SelectTrigger>
              <SelectContent>
                {SISTEMAS_AFETADOS.map((s) => (
                  <SelectItem key={s.codigo} value={s.codigo}>
                    {s.codigo} - {s.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.sistema_afetado_codigo && (
              <p className="text-xs text-destructive">
                {errors.sistema_afetado_codigo}
              </p>
            )}
          </div>
          )}

          {precisaObservacao && (
            <div className="space-y-2">
              <Label htmlFor="sistema_obs">
                Observação do sistema afetado
              </Label>
              <Textarea
                id="sistema_obs"
                value={sistemaObs}
                onChange={(e) => setSistemaObs(e.target.value.slice(0, 2000))}
                maxLength={2000}
                minLength={3}
                rows={3}
                placeholder="Descreva brevemente (3 a 2000 caracteres)"
                required
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {errors.sistema_afetado_observacao && (
                    <span className="text-destructive">
                      {errors.sistema_afetado_observacao}
                    </span>
                  )}
                </span>
                <span>{sistemaObs.length}/2000</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">
                {isAtestado ? "Início do afastamento" : "Data do documento"}
              </Label>
              <Input
                id="data_inicio"
                type="date"
                max={hoje()}
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
              {errors.data_inicio_afastamento && (
                <p className="text-xs text-destructive">
                  {errors.data_inicio_afastamento}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_registro">Data do registro</Label>
              <Input
                id="data_registro"
                type="date"
                value={dataRegistro}
                disabled
                readOnly
                title="Definida automaticamente pelo sistema"
              />
              <p className="text-xs text-muted-foreground">
                Definida automaticamente pelo sistema.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias">Dias de afastamento</Label>
            <Input
              id="dias"
              type="number"
              min={1}
              max={365}
              step={1}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              required
            />
            {errors.dias_afastamento && (
              <p className="text-xs text-destructive">{errors.dias_afastamento}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="arquivo">Arquivo do {rotuloDoc} (PDF, JPG ou PNG, até 10 MB)</Label>
            <Input
              id="arquivo"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            {errors.arquivo && (
              <p className="text-xs text-destructive">{errors.arquivo}</p>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium text-foreground pt-3">
              Declarações obrigatórias
            </p>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <Checkbox
                checked={decV}
                onCheckedChange={(v) => setDecV(v === true)}
                aria-invalid={!!errors.declaracao_veracidade}
              />
              <span>
                Declaro que as informações e o arquivo são <b>verdadeiros</b> e
                pertencem a este {rotuloDoc}.
              </span>
            </label>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <Checkbox
                checked={decO}
                onCheckedChange={(v) => setDecO(v === true)}
                aria-invalid={!!errors.declaracao_original_48h}
              />
              <span>
                Declaro que entregarei a <b>via original</b> ao RH em até{" "}
                <b>48 horas</b>.
              </span>
            </label>
            <label className="flex gap-2 items-start text-sm cursor-pointer">
              <Checkbox
                checked={decC}
                onCheckedChange={(v) => setDecC(v === true)}
                aria-invalid={!!errors.declaracao_ciencia_nao_validacao}
              />
              <span>
                Estou ciente de que este envio é apenas registro e{" "}
                <b>não garante validação automática</b>
                {isAtestado
                  ? " — a validação médica final é presencial, feita pelo SSO."
                  : " — o documento seguirá para análise do setor responsável."}
              </span>
            </label>
            {(errors.declaracao_veracidade ||
              errors.declaracao_original_48h ||
              errors.declaracao_ciencia_nao_validacao) && (
              <p className="text-xs text-destructive">
                Todas as declarações são obrigatórias.
              </p>
            )}
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" disabled={enviar.isPending}>
              {enviar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {rotuloEtapa}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
